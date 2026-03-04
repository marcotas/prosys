import { Habit } from './habit';

/**
 * Manages a `Map<string, Habit[]>` cache keyed by memberId.
 *
 * Supports stateful queries, mutations, and snapshot/restore for
 * optimistic update rollback. Does NOT notify -- controllers handle that.
 */
export class HabitCollection {
	private cache = new Map<string, Habit[]>();

	/** Replace all habits for a given member (initial load or server refresh). */
	hydrate(memberId: string, habits: Habit[]): void {
		this.cache.set(memberId, habits);
	}

	/** Check whether a member has been hydrated. */
	has(memberId: string): boolean {
		return this.cache.has(memberId);
	}

	/** Return all habits for a member, sorted by sortOrder ascending. */
	getAll(memberId: string): Habit[] {
		return [...(this.cache.get(memberId) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	/** Find a habit by id across all members. Returns undefined if not found. */
	findById(habitId: string): Habit | undefined {
		for (const habits of this.cache.values()) {
			const found = habits.find((h) => h.id === habitId);
			if (found) return found;
		}
		return undefined;
	}

	/** Append a habit to the given member, creating the key if absent. */
	insert(memberId: string, habit: Habit): void {
		const habits = this.cache.get(memberId) ?? [];
		habits.push(habit);
		this.cache.set(memberId, habits);
	}

	/** Remove a habit by id from any member. Returns true if found and removed. */
	remove(habitId: string): boolean {
		for (const [, habits] of this.cache) {
			const idx = habits.findIndex((h) => h.id === habitId);
			if (idx !== -1) {
				habits.splice(idx, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Set sortOrder on each habit within a member,
	 * according to the position in the provided `habitIds` array.
	 */
	reorder(memberId: string, habitIds: string[]): void {
		const habits = this.cache.get(memberId);
		if (!habits) return;

		habitIds.forEach((id, index) => {
			const habit = habits.find((h) => h.id === id);
			if (habit) habit.setSortOrder(index);
		});
	}

	/** Return the next available sortOrder for the given member (max + 1, or 0). */
	nextSortOrder(memberId: string): number {
		const habits = this.getAll(memberId);
		if (habits.length === 0) return 0;
		return Math.max(...habits.map((h) => h.sortOrder)) + 1;
	}

	/** Create an independent deep copy of the current cache for rollback. */
	snapshot(): Map<string, Habit[]> {
		const snap = new Map<string, Habit[]>();
		for (const [key, habits] of this.cache) {
			snap.set(key, habits.map((h) => h.clone()));
		}
		return snap;
	}

	/** Replace the current cache with a previously-captured snapshot. */
	restore(snapshot: Map<string, Habit[]>): void {
		this.cache = snapshot;
	}

	/** Remove all data from the collection. */
	clear(): void {
		this.cache.clear();
	}
}
