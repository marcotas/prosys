import type { Task, PlannerTask, FamilyHabitProgress } from '$lib/types';
import { wsHeaders } from './ws.svelte';
import { offlineQueue, isNetworkError } from './offline-queue.svelte';

type CreateTaskData = {
	memberId?: string | null;
	weekStart: string;
	dayIndex: number;
	title: string;
	emoji?: string;
};

const FAMILY_KEY_PREFIX = '__family__';

type UpdateTaskData = {
	title?: string;
	emoji?: string;
	completed?: boolean;
	dayIndex?: number;
	sortOrder?: number;
	memberId?: string | null;
};

function cacheKey(memberId: string, weekStart: string): string {
	return `${memberId}:${weekStart}`;
}

function createTaskStore() {
	// Map of "memberId:weekStart" → Task[]
	// Use $state.raw to avoid deep-proxy issues with Map — we always
	// create a new Map on every mutation, so reference tracking suffices.
	let weekCache = $state.raw<Map<string, Task[]>>(new Map());
	let loading = $state(false);

	return {
		get loading() {
			return loading;
		},

		/** Seed the cache with server-loaded data (SSR hydration). */
		hydrateWeek(memberId: string, weekStart: string, tasks: Task[]) {
			const key = cacheKey(memberId, weekStart);
			if (weekCache.has(key)) return;
			const next = new Map(weekCache);
			next.set(key, tasks);
			weekCache = next;
		},

		/**
		 * Load tasks for a member+week from the API. Skips if already cached.
		 */
		async loadWeek(memberId: string, weekStart: string): Promise<void> {
			const key = cacheKey(memberId, weekStart);
			if (weekCache.has(key)) return;

			loading = true;
			try {
				const res = await fetch(`/api/members/${memberId}/tasks?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
				const data: Task[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		/**
		 * Force-reload tasks for a member+week (bypasses cache).
		 */
		async reloadWeek(memberId: string, weekStart: string): Promise<void> {
			const key = cacheKey(memberId, weekStart);
			loading = true;
			try {
				const res = await fetch(`/api/members/${memberId}/tasks?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
				const data: Task[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		/**
		 * Get sorted tasks for a specific day from the cache.
		 */
		getTasksForDay(memberId: string, weekStart: string, dayIndex: number): Task[] {
			const key = cacheKey(memberId, weekStart);
			const all = weekCache.get(key);
			if (!all) return [];
			return all
				.filter((t) => t.dayIndex === dayIndex)
				.sort((a, b) => a.sortOrder - b.sortOrder);
		},

		/**
		 * Create a new task (optimistic).
		 */
		async create(data: CreateTaskData): Promise<Task> {
			const memberId = data.memberId ?? null;
			const key = memberId ? cacheKey(memberId, data.weekStart) : null;
			const familyKey = `${FAMILY_KEY_PREFIX}:${data.weekStart}`;
			const existing = key ? weekCache.get(key) ?? [] : [];
			const familyExisting = weekCache.get(familyKey);

			// Compute local sortOrder from whichever cache has data
			const pool = familyExisting ?? existing;
			const dayTasks = pool.filter((t) => t.dayIndex === data.dayIndex);
			const maxSort = dayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);

			// Optimistic task with a temporary id
			const tempId = `temp-${Date.now()}`;
			const optimistic: Task = {
				id: tempId,
				memberId,
				weekStart: data.weekStart,
				dayIndex: data.dayIndex,
				title: data.title,
				emoji: data.emoji,
				completed: false,
				sortOrder: maxSort + 1
			};

			// Optimistic insert into both member cache and family cache
			const next = new Map(weekCache);
			if (key) {
				next.set(key, [...existing, optimistic]);
			}
			if (familyExisting) {
				next.set(familyKey, [...familyExisting, optimistic]);
			}
			weekCache = next;

			try {
				const res = await fetch('/api/tasks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...wsHeaders() },
					body: JSON.stringify(data)
				});
				if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
				const created: Task = await res.json();

				// Replace temp task with server response
				const updated = new Map(weekCache);
				if (key) {
					const current = updated.get(key) ?? [];
					updated.set(key, current.map((t) => (t.id === tempId ? created : t)));
				}
				const fc = updated.get(familyKey);
				if (fc) {
					updated.set(familyKey, fc.map((t) => (t.id === tempId ? created : t)));
				}
				weekCache = updated;
				return created;
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'POST',
						url: '/api/tasks',
						body: data,
						headers: wsHeaders()
					});
					return optimistic;
				}
				// Actual server error — rollback
				const rollback = new Map(weekCache);
				if (key) {
					const current = rollback.get(key) ?? [];
					rollback.set(key, current.filter((t) => t.id !== tempId));
				}
				const fc = rollback.get(familyKey);
				if (fc) {
					rollback.set(familyKey, fc.filter((t) => t.id !== tempId));
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Update an existing task (optimistic).
		 */
		async update(id: string, data: UpdateTaskData): Promise<void> {
			// Find the task in any cache entry
			let foundTask: Task | undefined;
			const affectedKeys: string[] = [];
			for (const [key, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === id);
				if (t) {
					if (!foundTask) foundTask = t;
					affectedKeys.push(key);
				}
			}
			if (!foundTask || affectedKeys.length === 0) return;

			const previous = { ...foundTask };

			// Optimistic update across all affected caches
			const optimistic = { ...foundTask, ...data };
			const next = new Map(weekCache);
			for (const key of affectedKeys) {
				const list = next.get(key) ?? [];
				next.set(key, list.map((t) => (t.id === id ? optimistic : t)));
			}
			weekCache = next;

			try {
				const res = await fetch(`/api/tasks/${id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', ...wsHeaders() },
					body: JSON.stringify(data)
				});
				if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
				const updated: Task = await res.json();

				// Replace with server response across all affected caches
				const committed = new Map(weekCache);
				for (const key of affectedKeys) {
					const current = committed.get(key) ?? [];
					committed.set(key, current.map((t) => (t.id === id ? updated : t)));
				}
				weekCache = committed;
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PATCH',
						url: `/api/tasks/${id}`,
						body: data,
						headers: wsHeaders()
					});
					return;
				}
				// Rollback
				const rollback = new Map(weekCache);
				for (const key of affectedKeys) {
					const current = rollback.get(key) ?? [];
					rollback.set(key, current.map((t) => (t.id === id ? previous : t)));
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Toggle task completion (shorthand for update).
		 */
		async toggle(id: string): Promise<void> {
			// Find current state
			for (const [, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === id);
				if (t) {
					return this.update(id, { completed: !t.completed });
				}
			}
		},

		/**
		 * Delete a task (optimistic).
		 */
		async delete(id: string): Promise<void> {
			// Find the task in all cache entries
			const previousByKey = new Map<string, Task[]>();
			for (const [key, tasks] of weekCache) {
				const idx = tasks.findIndex((t) => t.id === id);
				if (idx !== -1) {
					previousByKey.set(key, [...tasks]);
				}
			}
			if (previousByKey.size === 0) return;

			// Optimistic removal from all affected caches
			const next = new Map(weekCache);
			for (const [key, prev] of previousByKey) {
				next.set(key, prev.filter((t) => t.id !== id));
			}
			weekCache = next;

			try {
				const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: wsHeaders() });
				if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'DELETE',
						url: `/api/tasks/${id}`,
						headers: wsHeaders()
					});
					return;
				}
				// Rollback
				const rollback = new Map(weekCache);
				for (const [key, prev] of previousByKey) {
					rollback.set(key, prev);
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Reorder tasks within a day (optimistic).
		 * taskIds is the new order of task IDs for that day.
		 */
		async reorder(memberId: string | null, weekStart: string, dayIndex: number, taskIds: string[]): Promise<void> {
			if (taskIds.length === 0) return;

			// Find all caches containing these tasks
			const previousByKey = new Map<string, Task[]>();
			const taskIdSet = new Set(taskIds);
			for (const [key, tasks] of weekCache) {
				if (tasks.some((t) => taskIdSet.has(t.id))) {
					previousByKey.set(key, [...tasks]);
				}
			}

			// Optimistic: update sortOrder across all affected caches
			const next = new Map(weekCache);
			for (const key of previousByKey.keys()) {
				const all = next.get(key) ?? [];
				next.set(
					key,
					all.map((t) => {
						if (t.dayIndex !== dayIndex) return t;
						const idx = taskIds.indexOf(t.id);
						if (idx === -1) return t;
						return { ...t, sortOrder: idx };
					})
				);
			}
			weekCache = next;

			try {
				const res = await fetch('/api/tasks/reorder', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', ...wsHeaders() },
					body: JSON.stringify({ memberId, weekStart, dayIndex, taskIds })
				});
				if (!res.ok) throw new Error(`Failed to reorder tasks: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PUT',
						url: '/api/tasks/reorder',
						body: { memberId, weekStart, dayIndex, taskIds },
						headers: wsHeaders()
					});
					return;
				}
				// Rollback
				const rollback = new Map(weekCache);
				for (const [key, prev] of previousByKey) {
					rollback.set(key, prev);
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Move a task to a different day (optimistic).
		 */
		async moveToDay(taskId: string, toDayIndex: number): Promise<void> {
			// Find the task in all cache entries
			let foundTask: Task | undefined;
			const previousByKey = new Map<string, Task[]>();
			for (const [key, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === taskId);
				if (t) {
					if (!foundTask) foundTask = t;
					previousByKey.set(key, [...tasks]);
				}
			}
			if (!foundTask || previousByKey.size === 0) return;
			if (foundTask.dayIndex === toDayIndex) return;

			// Compute sortOrder for the new day (use first cache that has data)
			const firstPrev = previousByKey.values().next().value!;
			const targetDayTasks = firstPrev.filter((t) => t.dayIndex === toDayIndex);
			const maxSort = targetDayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);

			// Optimistic: change dayIndex and sortOrder across all caches
			const moved = { ...foundTask, dayIndex: toDayIndex, sortOrder: maxSort + 1 };
			const next = new Map(weekCache);
			for (const key of previousByKey.keys()) {
				const all = next.get(key) ?? [];
				next.set(key, all.map((t) => (t.id === taskId ? moved : t)));
			}
			weekCache = next;

			try {
				const res = await fetch(`/api/tasks/${taskId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', ...wsHeaders() },
					body: JSON.stringify({ dayIndex: toDayIndex, sortOrder: maxSort + 1 })
				});
				if (!res.ok) throw new Error(`Failed to move task: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PATCH',
						url: `/api/tasks/${taskId}`,
						body: { dayIndex: toDayIndex, sortOrder: maxSort + 1 },
						headers: wsHeaders()
					});
					return;
				}
				// Rollback
				const rollback = new Map(weekCache);
				for (const [key, prev] of previousByKey) {
					rollback.set(key, prev);
				}
				weekCache = rollback;
				throw err;
			}
		},

		// ── Family / Planner methods ──────────────────────────

		hydrateFamilyWeek(weekStart: string, tasks: Task[]) {
			const key = `${FAMILY_KEY_PREFIX}:${weekStart}`;
			if (weekCache.has(key)) return;
			const next = new Map(weekCache);
			next.set(key, tasks);
			weekCache = next;
		},

		async loadFamilyWeek(weekStart: string): Promise<void> {
			const key = `${FAMILY_KEY_PREFIX}:${weekStart}`;
			if (weekCache.has(key)) return;

			loading = true;
			try {
				const res = await fetch(`/api/family/tasks?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load family tasks: ${res.status}`);
				const data: Task[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		async reloadFamilyWeek(weekStart: string): Promise<void> {
			const key = `${FAMILY_KEY_PREFIX}:${weekStart}`;
			loading = true;
			try {
				const res = await fetch(`/api/family/tasks?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load family tasks: ${res.status}`);
				const data: Task[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		getFamilyTasksForDay(weekStart: string, dayIndex: number): Task[] {
			const key = `${FAMILY_KEY_PREFIX}:${weekStart}`;
			const all = weekCache.get(key);
			if (!all) return [];
			return all
				.filter((t) => t.dayIndex === dayIndex)
				.sort((a, b) => a.sortOrder - b.sortOrder);
		},

		getAllFamilyTasks(weekStart: string): Task[] {
			const key = `${FAMILY_KEY_PREFIX}:${weekStart}`;
			return weekCache.get(key) ?? [];
		},

		async assignTask(taskId: string, memberId: string | null): Promise<void> {
			return this.update(taskId, { memberId });
		},

		// ── Remote apply methods (called by WS message handlers) ──

		applyRemoteCreate(task: Task) {
			const next = new Map(weekCache);
			// Update member cache
			if (task.memberId) {
				const key = cacheKey(task.memberId, task.weekStart);
				const existing = next.get(key);
				if (existing) {
					next.set(key, [...existing, task]);
				}
			}
			// Update family cache
			const familyKey = `${FAMILY_KEY_PREFIX}:${task.weekStart}`;
			const familyExisting = next.get(familyKey);
			if (familyExisting) {
				next.set(familyKey, [...familyExisting, task]);
			}
			weekCache = next;
		},

		applyRemoteUpdate(task: Task) {
			const next = new Map(weekCache);
			let updated = false;
			for (const [key, tasks] of next) {
				const idx = tasks.findIndex((t) => t.id === task.id);
				if (idx !== -1) {
					next.set(key, tasks.map((t) => (t.id === task.id ? task : t)));
					updated = true;
				}
			}
			if (updated) weekCache = next;
		},

		applyRemoteDelete(payload: { id: string; memberId: string | null; weekStart: string; dayIndex: number }) {
			const next = new Map(weekCache);
			let updated = false;
			// Remove from member cache
			if (payload.memberId) {
				const key = cacheKey(payload.memberId, payload.weekStart);
				const existing = next.get(key);
				if (existing) {
					next.set(key, existing.filter((t) => t.id !== payload.id));
					updated = true;
				}
			}
			// Remove from family cache
			const familyKey = `${FAMILY_KEY_PREFIX}:${payload.weekStart}`;
			const familyExisting = next.get(familyKey);
			if (familyExisting) {
				next.set(familyKey, familyExisting.filter((t) => t.id !== payload.id));
				updated = true;
			}
			if (updated) weekCache = next;
		},

		applyRemoteReorder(payload: { memberId: string | null; weekStart: string; dayIndex: number; taskIds: string[] }) {
			const next = new Map(weekCache);
			const applyReorder = (key: string) => {
				const existing = next.get(key);
				if (!existing) return;
				next.set(
					key,
					existing.map((t) => {
						if (t.dayIndex !== payload.dayIndex) return t;
						const idx = payload.taskIds.indexOf(t.id);
						if (idx === -1) return t;
						return { ...t, sortOrder: idx };
					})
				);
			};
			if (payload.memberId) {
				applyReorder(cacheKey(payload.memberId, payload.weekStart));
			}
			applyReorder(`${FAMILY_KEY_PREFIX}:${payload.weekStart}`);
			weekCache = next;
		},

		applyRemoteMove(payload: { task: Task; fromDay: number }) {
			const next = new Map(weekCache);
			for (const [key, tasks] of next) {
				const idx = tasks.findIndex((t) => t.id === payload.task.id);
				if (idx !== -1) {
					next.set(key, tasks.map((t) => (t.id === payload.task.id ? payload.task : t)));
				}
			}
			weekCache = next;
		},

		/**
		 * Clear all cached data (e.g. when switching members).
		 */
		clearCache() {
			weekCache = new Map();
		}
	};
}

export const taskStore = createTaskStore();
