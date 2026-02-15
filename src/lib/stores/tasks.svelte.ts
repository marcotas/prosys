import type { Task } from '$lib/types';
import { wsHeaders } from './ws.svelte';
import { offlineQueue, isNetworkError } from './offline-queue.svelte';

type CreateTaskData = {
	memberId: string;
	weekStart: string;
	dayIndex: number;
	title: string;
	emoji?: string;
};

type UpdateTaskData = {
	title?: string;
	emoji?: string;
	completed?: boolean;
	dayIndex?: number;
	sortOrder?: number;
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
			const key = cacheKey(data.memberId, data.weekStart);
			const existing = weekCache.get(key) ?? [];

			// Compute local sortOrder
			const dayTasks = existing.filter((t) => t.dayIndex === data.dayIndex);
			const maxSort = dayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);

			// Optimistic task with a temporary id
			const tempId = `temp-${Date.now()}`;
			const optimistic: Task = {
				id: tempId,
				memberId: data.memberId,
				weekStart: data.weekStart,
				dayIndex: data.dayIndex,
				title: data.title,
				emoji: data.emoji,
				completed: false,
				sortOrder: maxSort + 1
			};

			// Optimistic insert
			const next = new Map(weekCache);
			next.set(key, [...existing, optimistic]);
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
				const current = updated.get(key) ?? [];
				updated.set(
					key,
					current.map((t) => (t.id === tempId ? created : t))
				);
				weekCache = updated;
				return created;
			} catch (err) {
				if (isNetworkError(err)) {
					// Offline — keep optimistic state, queue for later
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
				const current = rollback.get(key) ?? [];
				rollback.set(
					key,
					current.filter((t) => t.id !== tempId)
				);
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Update an existing task (optimistic).
		 */
		async update(id: string, data: UpdateTaskData): Promise<void> {
			// Find the task in cache
			let foundKey = '';
			let foundTask: Task | undefined;
			for (const [key, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === id);
				if (t) {
					foundKey = key;
					foundTask = t;
					break;
				}
			}
			if (!foundTask || !foundKey) return;

			const previous = { ...foundTask };

			// Optimistic update
			const optimistic = { ...foundTask, ...data };
			const next = new Map(weekCache);
			const list = next.get(foundKey) ?? [];
			next.set(
				foundKey,
				list.map((t) => (t.id === id ? optimistic : t))
			);
			weekCache = next;

			try {
			const res = await fetch(`/api/tasks/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', ...wsHeaders() },
				body: JSON.stringify(data)
			});
				if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
				const updated: Task = await res.json();

				// Replace with server response
				const committed = new Map(weekCache);
				const current = committed.get(foundKey) ?? [];
				committed.set(
					foundKey,
					current.map((t) => (t.id === id ? updated : t))
				);
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
				const current = rollback.get(foundKey) ?? [];
				rollback.set(
					foundKey,
					current.map((t) => (t.id === id ? previous : t))
				);
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
			// Find the task in cache
			let foundKey = '';
			let previousList: Task[] = [];
			for (const [key, tasks] of weekCache) {
				const idx = tasks.findIndex((t) => t.id === id);
				if (idx !== -1) {
					foundKey = key;
					previousList = [...tasks];
					break;
				}
			}
			if (!foundKey) return;

			// Optimistic removal
			const next = new Map(weekCache);
			next.set(
				foundKey,
				previousList.filter((t) => t.id !== id)
			);
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
				rollback.set(foundKey, previousList);
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Reorder tasks within a day (optimistic).
		 * taskIds is the new order of task IDs for that day.
		 */
		async reorder(memberId: string, weekStart: string, dayIndex: number, taskIds: string[]): Promise<void> {
			if (taskIds.length === 0) return; // Nothing to reorder
			const key = cacheKey(memberId, weekStart);
			const previousList = weekCache.get(key) ? [...weekCache.get(key)!] : [];

			// Optimistic: update sortOrder based on new array position
			const next = new Map(weekCache);
			const all = next.get(key) ?? [];
			const updated = all.map((t) => {
				if (t.dayIndex !== dayIndex) return t;
				const idx = taskIds.indexOf(t.id);
				if (idx === -1) return t;
				return { ...t, sortOrder: idx };
			});
			next.set(key, updated);
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
				rollback.set(key, previousList);
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Move a task to a different day (optimistic).
		 */
		async moveToDay(taskId: string, toDayIndex: number): Promise<void> {
			// Find the task in cache
			let foundKey = '';
			let foundTask: Task | undefined;
			for (const [key, tasks] of weekCache) {
				const t = tasks.find((t) => t.id === taskId);
				if (t) {
					foundKey = key;
					foundTask = t;
					break;
				}
			}
			if (!foundTask || !foundKey) return;
			if (foundTask.dayIndex === toDayIndex) return;

			const previousList = [...(weekCache.get(foundKey) ?? [])];

			// Compute sortOrder for the new day (append at end)
			const targetDayTasks = previousList.filter((t) => t.dayIndex === toDayIndex);
			const maxSort = targetDayTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);

			// Optimistic: change dayIndex and sortOrder
			const moved = { ...foundTask, dayIndex: toDayIndex, sortOrder: maxSort + 1 };
			const next = new Map(weekCache);
			const all = next.get(foundKey) ?? [];
			next.set(
				foundKey,
				all.map((t) => (t.id === taskId ? moved : t))
			);
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
				rollback.set(foundKey, previousList);
				weekCache = rollback;
				throw err;
			}
		},

		// ── Remote apply methods (called by WS message handlers) ──

		applyRemoteCreate(task: Task) {
			const key = cacheKey(task.memberId, task.weekStart);
			const existing = weekCache.get(key);
			if (!existing) return; // Not cached — will load from API when needed
			const next = new Map(weekCache);
			next.set(key, [...existing, task]);
			weekCache = next;
		},

		applyRemoteUpdate(task: Task) {
			for (const [key, tasks] of weekCache) {
				const idx = tasks.findIndex((t) => t.id === task.id);
				if (idx !== -1) {
					const next = new Map(weekCache);
					next.set(key, tasks.map((t) => (t.id === task.id ? task : t)));
					weekCache = next;
					return;
				}
			}
		},

		applyRemoteDelete(payload: { id: string; memberId: string; weekStart: string; dayIndex: number }) {
			const key = cacheKey(payload.memberId, payload.weekStart);
			const existing = weekCache.get(key);
			if (!existing) return;
			const next = new Map(weekCache);
			next.set(key, existing.filter((t) => t.id !== payload.id));
			weekCache = next;
		},

		applyRemoteReorder(payload: { memberId: string; weekStart: string; dayIndex: number; taskIds: string[] }) {
			const key = cacheKey(payload.memberId, payload.weekStart);
			const existing = weekCache.get(key);
			if (!existing) return;
			const next = new Map(weekCache);
			next.set(
				key,
				existing.map((t) => {
					if (t.dayIndex !== payload.dayIndex) return t;
					const idx = payload.taskIds.indexOf(t.id);
					if (idx === -1) return t;
					return { ...t, sortOrder: idx };
				})
			);
			weekCache = next;
		},

		applyRemoteMove(payload: { task: Task; fromDay: number }) {
			// The moved task already has the new dayIndex + sortOrder in payload.task
			for (const [key, tasks] of weekCache) {
				const idx = tasks.findIndex((t) => t.id === payload.task.id);
				if (idx !== -1) {
					const next = new Map(weekCache);
					next.set(key, tasks.map((t) => (t.id === payload.task.id ? payload.task : t)));
					weekCache = next;
					return;
				}
			}
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
