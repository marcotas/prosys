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
			const memberChanged = data.memberId !== undefined && data.memberId !== foundTask.memberId;

			const next = new Map(weekCache);
			for (const key of affectedKeys) {
				const list = next.get(key) ?? [];
				if (memberChanged && !key.startsWith(FAMILY_KEY_PREFIX)) {
					// Old member cache: remove the task
					next.set(key, list.filter((t) => t.id !== id));
				} else {
					// Family cache or same-member update: update in place
					next.set(key, list.map((t) => (t.id === id ? optimistic : t)));
				}
			}
			// Add to new member's cache if member changed and cache is loaded
			if (memberChanged && optimistic.memberId) {
				const newKey = cacheKey(optimistic.memberId, foundTask.weekStart);
				const existing = next.get(newKey);
				if (existing && !existing.some((t) => t.id === id)) {
					next.set(newKey, [...existing, optimistic]);
				}
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

				// Replace with server response in all caches that now contain the task
				const committed = new Map(weekCache);
				for (const [key, tasks] of committed) {
					if (tasks.some((t) => t.id === id)) {
						committed.set(key, tasks.map((t) => (t.id === id ? updated : t)));
					}
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
				// Rollback: remove task from everywhere and add back to original locations
				const rollback = new Map(weekCache);
				for (const [key, tasks] of rollback) {
					if (tasks.some((t) => t.id === id)) {
						rollback.set(key, tasks.filter((t) => t.id !== id));
					}
				}
				for (const key of affectedKeys) {
					const list = rollback.get(key) ?? [];
					rollback.set(key, [...list, previous]);
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
		 * Move a task to a specific date (supports cross-week moves).
		 */
		async moveToDate(taskId: string, toWeekStart: string, toDayIndex: number): Promise<void> {
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
			if (foundTask.dayIndex === toDayIndex && foundTask.weekStart === toWeekStart) return;

			const isCrossWeek = foundTask.weekStart !== toWeekStart;

			// Compute sortOrder for the target day
			// Look in target week caches if cross-week, or current caches if same-week
			let maxSort = -1;
			if (isCrossWeek) {
				// Check target week caches
				const targetMemberKey = foundTask.memberId ? cacheKey(foundTask.memberId, toWeekStart) : null;
				const targetFamilyKey = `${FAMILY_KEY_PREFIX}:${toWeekStart}`;
				const targetList = (targetMemberKey && weekCache.get(targetMemberKey)) || weekCache.get(targetFamilyKey);
				if (targetList) {
					const targetDayTasks = targetList.filter((t) => t.dayIndex === toDayIndex);
					maxSort = targetDayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);
				}
			} else {
				const firstPrev = previousByKey.values().next().value!;
				const targetDayTasks = firstPrev.filter((t) => t.dayIndex === toDayIndex);
				maxSort = targetDayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);
			}

			const moved = { ...foundTask, weekStart: toWeekStart, dayIndex: toDayIndex, sortOrder: maxSort + 1 };

			// Optimistic update
			const next = new Map(weekCache);
			if (isCrossWeek) {
				// Remove from old caches
				for (const key of previousByKey.keys()) {
					const all = next.get(key) ?? [];
					next.set(key, all.filter((t) => t.id !== taskId));
				}
				// Add to target caches (only if loaded)
				if (foundTask.memberId) {
					const targetKey = cacheKey(foundTask.memberId, toWeekStart);
					const existing = next.get(targetKey);
					if (existing) {
						next.set(targetKey, [...existing, moved]);
					}
				}
				const targetFamilyKey = `${FAMILY_KEY_PREFIX}:${toWeekStart}`;
				const familyExisting = next.get(targetFamilyKey);
				if (familyExisting) {
					next.set(targetFamilyKey, [...familyExisting, moved]);
				}
			} else {
				// Same-week: update in place
				for (const key of previousByKey.keys()) {
					const all = next.get(key) ?? [];
					next.set(key, all.map((t) => (t.id === taskId ? moved : t)));
				}
			}
			weekCache = next;

			const patchBody: Record<string, unknown> = { dayIndex: toDayIndex, sortOrder: maxSort + 1 };
			if (isCrossWeek) patchBody.weekStart = toWeekStart;

			try {
				const res = await fetch(`/api/tasks/${taskId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', ...wsHeaders() },
					body: JSON.stringify(patchBody)
				});
				if (!res.ok) throw new Error(`Failed to move task: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PATCH',
						url: `/api/tasks/${taskId}`,
						body: patchBody,
						headers: wsHeaders()
					});
					return;
				}
				// Rollback
				const rollback = new Map(weekCache);
				// Remove from any caches we added to
				if (isCrossWeek) {
					if (foundTask.memberId) {
						const targetKey = cacheKey(foundTask.memberId, toWeekStart);
						const existing = rollback.get(targetKey);
						if (existing) rollback.set(targetKey, existing.filter((t) => t.id !== taskId));
					}
					const targetFamilyKey = `${FAMILY_KEY_PREFIX}:${toWeekStart}`;
					const familyExisting = rollback.get(targetFamilyKey);
					if (familyExisting) rollback.set(targetFamilyKey, familyExisting.filter((t) => t.id !== taskId));
				}
				// Restore original caches
				for (const [key, prev] of previousByKey) {
					rollback.set(key, prev);
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Move a task to a different day within the same week (optimistic).
		 * Delegates to moveToDate using the task's current weekStart.
		 */
		async moveToDay(taskId: string, toDayIndex: number): Promise<void> {
			// Find the task to get its weekStart
			for (const [, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === taskId);
				if (t) {
					return this.moveToDate(taskId, t.weekStart, toDayIndex);
				}
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
			const rightMemberKey = task.memberId ? cacheKey(task.memberId, task.weekStart) : null;
			const familyKey = `${FAMILY_KEY_PREFIX}:${task.weekStart}`;

			for (const [key, tasks] of next) {
				const idx = tasks.findIndex((t) => t.id === task.id);
				if (idx !== -1) {
					if (key === familyKey || key === rightMemberKey) {
						// Correct cache: update in place
						next.set(key, tasks.map((t) => (t.id === task.id ? task : t)));
					} else {
						// Wrong member cache (task was reassigned): remove it
						next.set(key, tasks.filter((t) => t.id !== task.id));
					}
					updated = true;
				}
			}

			// Add to correct member cache if not already there
			if (rightMemberKey) {
				const existing = next.get(rightMemberKey);
				if (existing && !existing.some((t) => t.id === task.id)) {
					next.set(rightMemberKey, [...existing, task]);
					updated = true;
				}
			}

			// Ensure task is in family cache if loaded
			const familyTasks = next.get(familyKey);
			if (familyTasks && !familyTasks.some((t) => t.id === task.id)) {
				next.set(familyKey, [...familyTasks, task]);
				updated = true;
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

		applyRemoteMove(payload: { task: Task; fromDay: number; fromWeek?: string }) {
			const next = new Map(weekCache);
			const isCrossWeek = payload.fromWeek && payload.fromWeek !== payload.task.weekStart;

			if (isCrossWeek) {
				// Remove from old week caches
				if (payload.task.memberId) {
					const oldKey = cacheKey(payload.task.memberId, payload.fromWeek!);
					const oldList = next.get(oldKey);
					if (oldList) next.set(oldKey, oldList.filter((t) => t.id !== payload.task.id));
				}
				const oldFamilyKey = `${FAMILY_KEY_PREFIX}:${payload.fromWeek}`;
				const oldFamily = next.get(oldFamilyKey);
				if (oldFamily) next.set(oldFamilyKey, oldFamily.filter((t) => t.id !== payload.task.id));

				// Add to new week caches (if loaded)
				if (payload.task.memberId) {
					const newKey = cacheKey(payload.task.memberId, payload.task.weekStart);
					const newList = next.get(newKey);
					if (newList && !newList.some((t) => t.id === payload.task.id)) {
						next.set(newKey, [...newList, payload.task]);
					}
				}
				const newFamilyKey = `${FAMILY_KEY_PREFIX}:${payload.task.weekStart}`;
				const newFamily = next.get(newFamilyKey);
				if (newFamily && !newFamily.some((t) => t.id === payload.task.id)) {
					next.set(newFamilyKey, [...newFamily, payload.task]);
				}
			} else {
				// Same-week move: update in place
				for (const [key, tasks] of next) {
					const idx = tasks.findIndex((t) => t.id === payload.task.id);
					if (idx !== -1) {
						next.set(key, tasks.map((t) => (t.id === payload.task.id ? payload.task : t)));
					}
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
