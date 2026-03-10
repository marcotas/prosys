import type { HabitWithDays, FamilyHabitProgress } from '$lib/types';

type CacheValue = HabitWithDays[] | FamilyHabitProgress[];

const FAMILY_KEY = '__family_habits__';

/**
 * Manages a `Map<string, HabitWithDays[] | FamilyHabitProgress[]>` cache
 * keyed by `${memberId}:${weekStart}` for member data and
 * `__family_habits__:${weekStart}` for family data.
 *
 * Supports stateful queries, mutations, and snapshot/restore for
 * optimistic update rollback. Does NOT notify -- controllers handle that.
 */
export class HabitWeekCache {
	private cache = new Map<string, CacheValue>();

	/** Build a member-scoped cache key. */
	static memberKey(memberId: string, weekStart: string): string {
		return `${memberId}:${weekStart}`;
	}

	/** Build a family-scoped cache key. */
	static familyKey(weekStart: string): string {
		return `${FAMILY_KEY}:${weekStart}`;
	}

	/** Check whether a key has been hydrated. */
	has(key: string): boolean {
		return this.cache.has(key);
	}

	/** Replace data for a given key (initial load or server refresh). */
	hydrate(key: string, data: CacheValue): void {
		this.cache.set(key, data);
	}

	/** Return habits with days for a member-scoped key, or empty array. */
	getHabitsWithDays(key: string): HabitWithDays[] {
		return (this.cache.get(key) as HabitWithDays[]) ?? [];
	}

	/** Return family habit progress for a family-scoped key, or empty array. */
	getFamilyHabitProgress(key: string): FamilyHabitProgress[] {
		return (this.cache.get(key) as FamilyHabitProgress[]) ?? [];
	}

	/** Add a habit to ALL cached weeks for a given member. */
	insertHabit(memberId: string, habit: HabitWithDays): void {
		for (const [key, value] of this.cache) {
			if (key.startsWith(`${memberId}:`)) {
				(value as HabitWithDays[]).push({ ...habit, days: [...habit.days] });
			}
		}
	}

	/**
	 * Update a habit (by id) in all cached member weeks (not family).
	 * Returns the memberId if found, undefined otherwise.
	 */
	updateHabit(id: string, data: Partial<HabitWithDays>): string | undefined {
		let foundMemberId: string | undefined;

		for (const [key, value] of this.cache) {
			if (key.startsWith(FAMILY_KEY)) continue;
			const habits = value as HabitWithDays[];
			const idx = habits.findIndex((h) => h.id === id);
			if (idx !== -1) {
				foundMemberId = habits[idx].memberId;
				habits[idx] = { ...habits[idx], ...data };
			}
		}

		return foundMemberId;
	}

	/**
	 * Remove a habit (by id) from all cached member weeks (not family).
	 * Returns the memberId if found, undefined otherwise.
	 */
	removeHabit(id: string): string | undefined {
		let foundMemberId: string | undefined;

		for (const [key, value] of this.cache) {
			if (key.startsWith(FAMILY_KEY)) continue;
			const habits = value as HabitWithDays[];
			const idx = habits.findIndex((h) => h.id === id);
			if (idx !== -1) {
				foundMemberId = habits[idx].memberId;
				habits.splice(idx, 1);
			}
		}

		return foundMemberId;
	}

	/**
	 * Toggle the boolean for a habit day in BOTH member-scoped AND family-scoped caches.
	 */
	toggleDay(habitId: string, weekStart: string, dayIndex: number): void {
		// Toggle in member-scoped caches
		for (const [key, value] of this.cache) {
			if (key.startsWith(FAMILY_KEY)) continue;
			if (!key.endsWith(`:${weekStart}`)) continue;
			const habits = value as HabitWithDays[];
			const habit = habits.find((h) => h.id === habitId);
			if (habit) {
				habit.days[dayIndex] = !habit.days[dayIndex];
			}
		}

		// Toggle in family-scoped cache
		const fk = HabitWeekCache.familyKey(weekStart);
		const familyData = this.cache.get(fk) as FamilyHabitProgress[] | undefined;
		if (familyData) {
			for (const mp of familyData) {
				const habit = mp.habits.find((h) => h.id === habitId);
				if (habit) {
					habit.days[dayIndex] = !habit.days[dayIndex];
				}
			}
		}
	}

	/**
	 * Set the boolean value for a habit day (for remote sync where we know the value).
	 * Updates BOTH member-scoped AND family-scoped caches.
	 */
	setDay(habitId: string, weekStart: string, dayIndex: number, completed: boolean): void {
		// Set in member-scoped caches
		for (const [key, value] of this.cache) {
			if (key.startsWith(FAMILY_KEY)) continue;
			if (!key.endsWith(`:${weekStart}`)) continue;
			const habits = value as HabitWithDays[];
			const habit = habits.find((h) => h.id === habitId);
			if (habit) {
				habit.days[dayIndex] = completed;
			}
		}

		// Set in family-scoped cache
		const fk = HabitWeekCache.familyKey(weekStart);
		const familyData = this.cache.get(fk) as FamilyHabitProgress[] | undefined;
		if (familyData) {
			for (const mp of familyData) {
				const habit = mp.habits.find((h) => h.id === habitId);
				if (habit) {
					habit.days[dayIndex] = completed;
				}
			}
		}
	}

	/**
	 * Reorder habits for a member based on array position.
	 * Updates sortOrder and sorts in all cached member weeks.
	 */
	reorderHabits(memberId: string, habitIds: string[]): void {
		for (const [key, value] of this.cache) {
			if (!key.startsWith(`${memberId}:`)) continue;
			const habits = value as HabitWithDays[];
			for (const habit of habits) {
				const idx = habitIds.indexOf(habit.id);
				if (idx !== -1) {
					habit.sortOrder = idx;
				}
			}
			habits.sort((a, b) => a.sortOrder - b.sortOrder);
		}
	}

	/** Delete all family-scoped (`__family_habits__:*`) keys. */
	invalidateFamilyCaches(): void {
		for (const key of this.cache.keys()) {
			if (key.startsWith(FAMILY_KEY)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Replace a temp habit with server data in all cached member weeks (not family).
	 */
	replaceTemp(memberId: string, tempId: string, serverHabit: HabitWithDays): void {
		for (const [key, value] of this.cache) {
			if (!key.startsWith(`${memberId}:`)) continue;
			const habits = value as HabitWithDays[];
			const idx = habits.findIndex((h) => h.id === tempId);
			if (idx !== -1) {
				habits[idx] = { ...serverHabit, days: [...serverHabit.days] };
			}
		}
	}

	/** Search all member-scoped caches for a habit's memberId. */
	findMemberIdByHabitId(habitId: string): string | undefined {
		for (const [key, value] of this.cache) {
			if (key.startsWith(FAMILY_KEY)) continue;
			const habits = value as HabitWithDays[];
			const habit = habits.find((h) => h.id === habitId);
			if (habit) return habit.memberId;
		}
		return undefined;
	}

	/** Create an independent deep copy of the current cache for rollback. */
	snapshot(): Map<string, CacheValue> {
		return structuredClone(this.cache);
	}

	/** Replace the current cache with a previously-captured snapshot. */
	restore(snap: Map<string, CacheValue>): void {
		this.cache = snap;
	}

	/** Remove all data from the cache. */
	clear(): void {
		this.cache.clear();
	}
}
