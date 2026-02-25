import type { Habit, HabitWithDays, FamilyHabitProgress } from '$lib/types';
import { wsHeaders } from './ws.svelte';
import { offlineQueue, isNetworkError } from './offline-queue.svelte';

const FAMILY_KEY = '__family_habits__';

function cacheKey(memberId: string, weekStart: string): string {
	return `${memberId}:${weekStart}`;
}

function familyCacheKey(weekStart: string): string {
	return `${FAMILY_KEY}:${weekStart}`;
}

function createHabitStore() {
	// Cache of loaded weeks: "memberId:weekStart" → HabitWithDays[]
	// This holds the merged habit definitions + completions for each week
	// Use $state.raw to avoid deep-proxy issues with Map — we always
	// create a new Map on every mutation, so reference tracking suffices.
	let weekCache = $state.raw<Map<string, HabitWithDays[]>>(new Map());
	let loading = $state(false);

	return {
		get loading() {
			return loading;
		},

		/** Seed the cache with server-loaded data (SSR hydration). */
		hydrateWeek(memberId: string, weekStart: string, habitList: HabitWithDays[]) {
			const key = cacheKey(memberId, weekStart);
			if (weekCache.has(key)) return;
			const next = new Map(weekCache);
			next.set(key, habitList);
			weekCache = next;
		},

		/**
		 * Load habits with completions for a member+week from the API.
		 * Skips if already cached.
		 */
		async loadWeek(memberId: string, weekStart: string): Promise<void> {
			const key = cacheKey(memberId, weekStart);
			if (weekCache.has(key)) return;

			loading = true;
			try {
				const res = await fetch(`/api/members/${memberId}/habits?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load habits: ${res.status}`);
				const data: HabitWithDays[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		/**
		 * Force-reload habits for a member+week (bypasses cache).
		 */
		async reloadWeek(memberId: string, weekStart: string): Promise<void> {
			const key = cacheKey(memberId, weekStart);
			loading = true;
			try {
				const res = await fetch(`/api/members/${memberId}/habits?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load habits: ${res.status}`);
				const data: HabitWithDays[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		/**
		 * Get habits with completion data for a specific member+week.
		 */
		getHabitsWithDays(memberId: string, weekStart: string): HabitWithDays[] {
			const key = cacheKey(memberId, weekStart);
			return weekCache.get(key) ?? [];
		},

		/**
		 * Create a new habit (optimistic).
		 */
		async create(memberId: string, name: string, emoji?: string): Promise<Habit> {
			// Build optimistic habit — add to all cached weeks for this member
			const tempId = `temp-${Date.now()}`;
			const optimistic: HabitWithDays = {
				id: tempId,
				memberId,
				name,
				emoji,
				sortOrder: 0,
				days: [false, false, false, false, false, false, false]
			};

			// Compute sortOrder from existing habits and insert optimistically
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${memberId}:`)) {
					const maxSort = habits.reduce((max, h) => Math.max(max, h.sortOrder), -1);
					optimistic.sortOrder = maxSort + 1;
					next.set(key, [...habits, { ...optimistic, sortOrder: maxSort + 1 }]);
				}
			}
			weekCache = next;

			try {
			const res = await fetch('/api/habits', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...wsHeaders() },
				body: JSON.stringify({ memberId, name, emoji })
			});
				if (!res.ok) throw new Error(`Failed to create habit: ${res.status}`);
				const created: Habit = await res.json();

				// Replace temp habit with server response in all cached weeks
				const updated = new Map(weekCache);
				for (const [key, habits] of updated) {
					if (key.startsWith(`${memberId}:`)) {
						updated.set(
							key,
							habits.map((h) =>
								h.id === tempId
									? { ...created, days: [false, false, false, false, false, false, false] }
									: h
							)
						);
					}
				}
				weekCache = updated;
				return created;
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'POST',
						url: '/api/habits',
						body: { memberId, name, emoji },
						headers: wsHeaders()
					});
					return { id: tempId, memberId, name, emoji, sortOrder: optimistic.sortOrder } as Habit;
				}
				// Rollback — remove optimistic habit from all cached weeks
				const rollback = new Map(weekCache);
				for (const [key, habits] of rollback) {
					if (key.startsWith(`${memberId}:`)) {
						rollback.set(
							key,
							habits.filter((h) => h.id !== tempId)
						);
					}
				}
				weekCache = rollback;
				throw err;
			}
		},

		/**
		 * Update an existing habit definition (optimistic).
		 */
		async update(id: string, data: { name?: string; emoji?: string }): Promise<void> {
			// Find the habit in any cached week
			let memberId = '';
			const previousByKey = new Map<string, HabitWithDays[]>();

			for (const [key, habits] of weekCache) {
				const habit = habits.find((h) => h.id === id);
				if (habit) {
					memberId = habit.memberId;
					break;
				}
			}
			if (!memberId) return;

			// Snapshot and apply optimistic update to all cached weeks for this member
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${memberId}:`)) {
					previousByKey.set(key, [...habits]);
					next.set(
						key,
						habits.map((h) => (h.id === id ? { ...h, ...data } : h))
					);
				}
			}
			weekCache = next;

			try {
			const res = await fetch(`/api/habits/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', ...wsHeaders() },
				body: JSON.stringify(data)
			});
				if (!res.ok) throw new Error(`Failed to update habit: ${res.status}`);
				const updated: Habit = await res.json();

				// Replace with server response in all cached weeks
				const committed = new Map(weekCache);
				for (const [key, habits] of committed) {
					if (key.startsWith(`${memberId}:`)) {
						committed.set(
							key,
							habits.map((h) => (h.id === id ? { ...h, ...updated } : h))
						);
					}
				}
				weekCache = committed;
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PATCH',
						url: `/api/habits/${id}`,
						body: data,
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
		 * Delete a habit (optimistic). Cascades to completions on the server.
		 */
		async delete(id: string): Promise<void> {
			// Find the member this habit belongs to
			let memberId = '';
			const previousByKey = new Map<string, HabitWithDays[]>();

			for (const [key, habits] of weekCache) {
				const habit = habits.find((h) => h.id === id);
				if (habit) {
					memberId = habit.memberId;
					break;
				}
			}
			if (!memberId) return;

			// Snapshot and remove optimistically from all cached weeks
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${memberId}:`)) {
					previousByKey.set(key, [...habits]);
					next.set(
						key,
						habits.filter((h) => h.id !== id)
					);
				}
			}
			weekCache = next;

			try {
				const res = await fetch(`/api/habits/${id}`, { method: 'DELETE', headers: wsHeaders() });
				if (!res.ok) throw new Error(`Failed to delete habit: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'DELETE',
						url: `/api/habits/${id}`,
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
		 * Toggle a habit completion for a specific day (optimistic).
		 */
		async toggle(habitId: string, weekStart: string, dayIndex: number): Promise<void> {
			// Find the habit in the specific week cache
			let foundKey = '';
			let memberId = '';

			for (const [key, habits] of weekCache) {
				const habit = habits.find((h) => h.id === habitId);
				if (habit && key.endsWith(`:${weekStart}`)) {
					foundKey = key;
					memberId = habit.memberId;
					break;
				}
			}
			if (!foundKey) return;

			const previousList = [...(weekCache.get(foundKey) ?? [])];

			// Optimistic toggle
			const next = new Map(weekCache);
			const habits = next.get(foundKey) ?? [];
			next.set(
				foundKey,
				habits.map((h) => {
					if (h.id === habitId) {
						const newDays = [...h.days];
						newDays[dayIndex] = !newDays[dayIndex];
						return { ...h, days: newDays };
					}
					return h;
				})
			);
			weekCache = next;

			try {
			const res = await fetch(`/api/habits/${habitId}/toggle`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', ...wsHeaders() },
				body: JSON.stringify({ weekStart, dayIndex })
			});
				if (!res.ok) throw new Error(`Failed to toggle habit: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PUT',
						url: `/api/habits/${habitId}/toggle`,
						body: { weekStart, dayIndex },
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
		 * Reorder habits for a member (optimistic).
		 * habitIds is the new order of habit IDs.
		 */
		async reorder(memberId: string, habitIds: string[]): Promise<void> {
			// Snapshot all cached weeks for this member
			const previousByKey = new Map<string, HabitWithDays[]>();
			for (const [key, habits] of weekCache) {
				if (key.startsWith(`${memberId}:`)) {
					previousByKey.set(key, [...habits]);
				}
			}

			// Optimistic: update sortOrder based on new array position
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${memberId}:`)) {
					next.set(
						key,
						habits.map((h) => {
							const idx = habitIds.indexOf(h.id);
							if (idx === -1) return h;
							return { ...h, sortOrder: idx };
						}).sort((a, b) => a.sortOrder - b.sortOrder)
					);
				}
			}
			weekCache = next;

			try {
			const res = await fetch('/api/habits/reorder', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', ...wsHeaders() },
				body: JSON.stringify({ memberId, habitIds })
			});
				if (!res.ok) throw new Error(`Failed to reorder habits: ${res.status}`);
			} catch (err) {
				if (isNetworkError(err)) {
					await offlineQueue.enqueue({
						method: 'PUT',
						url: '/api/habits/reorder',
						body: { memberId, habitIds },
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

		hydrateFamilyWeek(weekStart: string, data: FamilyHabitProgress[]) {
			const key = familyCacheKey(weekStart);
			if (weekCache.has(key)) return;
			const next = new Map(weekCache);
			next.set(key, data as any);
			weekCache = next;
		},

		async loadFamilyWeek(weekStart: string): Promise<void> {
			const key = familyCacheKey(weekStart);
			if (weekCache.has(key)) return;

			loading = true;
			try {
				const res = await fetch(`/api/family/habits?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load family habits: ${res.status}`);
				const data: FamilyHabitProgress[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data as any);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		async reloadFamilyWeek(weekStart: string): Promise<void> {
			const key = familyCacheKey(weekStart);
			loading = true;
			try {
				const res = await fetch(`/api/family/habits?week=${weekStart}`);
				if (!res.ok) throw new Error(`Failed to load family habits: ${res.status}`);
				const data: FamilyHabitProgress[] = await res.json();
				const next = new Map(weekCache);
				next.set(key, data as any);
				weekCache = next;
			} finally {
				loading = false;
			}
		},

		getFamilyHabitProgress(weekStart: string): FamilyHabitProgress[] {
			const key = familyCacheKey(weekStart);
			return (weekCache.get(key) as any as FamilyHabitProgress[]) ?? [];
		},

		// ── Remote apply methods (called by WS message handlers) ──

		applyRemoteCreate(habit: Habit) {
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${habit.memberId}:`)) {
					next.set(key, [...habits, { ...habit, days: [false, false, false, false, false, false, false] }]);
				}
			}
			// Invalidate family caches so they reload with fresh data
			for (const key of next.keys()) {
				if (key.startsWith(FAMILY_KEY)) next.delete(key);
			}
			weekCache = next;
		},

		applyRemoteUpdate(habit: Habit) {
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${habit.memberId}:`)) {
					next.set(key, habits.map((h) => (h.id === habit.id ? { ...h, ...habit } : h)));
				}
			}
			for (const key of next.keys()) {
				if (key.startsWith(FAMILY_KEY)) next.delete(key);
			}
			weekCache = next;
		},

		applyRemoteDelete(payload: { id: string; memberId: string }) {
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${payload.memberId}:`)) {
					next.set(key, habits.filter((h) => h.id !== payload.id));
				}
			}
			for (const key of next.keys()) {
				if (key.startsWith(FAMILY_KEY)) next.delete(key);
			}
			weekCache = next;
		},

		applyRemoteToggle(payload: { habitId: string; weekStart: string; dayIndex: number; completed: boolean }) {
			const next = new Map(weekCache);
			// Update member-specific caches
			for (const [key, habits] of next) {
				if (key.startsWith(FAMILY_KEY)) continue;
				if (!key.endsWith(`:${payload.weekStart}`)) continue;
				const habit = habits.find((h) => h.id === payload.habitId);
				if (!habit) continue;

				next.set(
					key,
					habits.map((h) => {
						if (h.id !== payload.habitId) return h;
						const newDays = [...h.days];
						newDays[payload.dayIndex] = payload.completed;
						return { ...h, days: newDays };
					})
				);
			}
			// Update family cache inline (toggle is the most common remote change)
			const fk = familyCacheKey(payload.weekStart);
			const familyData = next.get(fk) as any as FamilyHabitProgress[] | undefined;
			if (familyData) {
				const updated = familyData.map((mp) => ({
					...mp,
					habits: mp.habits.map((h) => {
						if (h.id !== payload.habitId) return h;
						const newDays = [...h.days];
						newDays[payload.dayIndex] = payload.completed;
						return { ...h, days: newDays };
					})
				}));
				next.set(fk, updated as any);
			}
			weekCache = next;
		},

		applyRemoteReorder(payload: { memberId: string; habitIds: string[] }) {
			const next = new Map(weekCache);
			for (const [key, habits] of next) {
				if (key.startsWith(`${payload.memberId}:`)) {
					next.set(
						key,
						habits
							.map((h) => {
								const idx = payload.habitIds.indexOf(h.id);
								if (idx === -1) return h;
								return { ...h, sortOrder: idx };
							})
							.sort((a, b) => a.sortOrder - b.sortOrder)
					);
				}
			}
			for (const key of next.keys()) {
				if (key.startsWith(FAMILY_KEY)) next.delete(key);
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

export const habitStore = createHabitStore();
