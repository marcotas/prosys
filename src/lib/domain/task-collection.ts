import { Task } from './task';

/**
 * Manages a `Map<string, Task[]>` cache where keys are composite strings
 * such as `${memberId}:${weekStart}`.
 *
 * Supports stateful queries, mutations, and snapshot/restore for
 * optimistic update rollback. Does NOT notify -- controllers handle that.
 */
export class TaskCollection {
	private cache = new Map<string, Task[]>();

	/** Replace all tasks for a given key (initial load or server refresh). */
	hydrate(key: string, tasks: Task[]): void {
		this.cache.set(key, tasks);
	}

	/** Check whether a key has been hydrated. */
	has(key: string): boolean {
		return this.cache.has(key);
	}

	/** Return tasks for a specific day, sorted by sortOrder ascending. */
	getForDay(key: string, dayIndex: number): Task[] {
		const tasks = this.cache.get(key) ?? [];
		return tasks
			.filter((t) => t.dayIndex === dayIndex)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	/** Return all tasks for a key (unfiltered, insertion order). */
	getAll(key: string): Task[] {
		return this.cache.get(key) ?? [];
	}

	/** Find a task by id across all keys. Returns undefined if not found. */
	findById(taskId: string): Task | undefined {
		for (const tasks of this.cache.values()) {
			const found = tasks.find((t) => t.id === taskId);
			if (found) return found;
		}
		return undefined;
	}

	/** Find ALL instances of a task by id across all keys. */
	findAllById(taskId: string): Task[] {
		const results: Task[] = [];
		for (const tasks of this.cache.values()) {
			const found = tasks.find((t) => t.id === taskId);
			if (found) results.push(found);
		}
		return results;
	}

	/** Append a task to the given key, creating the key if absent. */
	insert(key: string, task: Task): void {
		const tasks = this.cache.get(key) ?? [];
		tasks.push(task);
		this.cache.set(key, tasks);
	}

	/** Remove a task by id from any key. Returns true if found and removed. */
	remove(taskId: string): boolean {
		for (const [, tasks] of this.cache) {
			const idx = tasks.findIndex((t) => t.id === taskId);
			if (idx !== -1) {
				tasks.splice(idx, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Set sortOrder on each task matching `dayIndex` within `key`,
	 * according to the position in the provided `taskIds` array.
	 */
	reorder(key: string, dayIndex: number, taskIds: string[]): void {
		const tasks = this.cache.get(key);
		if (!tasks) return;

		taskIds.forEach((id, index) => {
			const task = tasks.find((t) => t.id === id && t.dayIndex === dayIndex);
			if (task) task.setSortOrder(index);
		});
	}

	/** Return the next available sortOrder for the given day (max + 1, or 0). */
	nextSortOrder(key: string, dayIndex: number): number {
		const dayTasks = this.getForDay(key, dayIndex);
		if (dayTasks.length === 0) return 0;
		return Math.max(...dayTasks.map((t) => t.sortOrder)) + 1;
	}

	/** Create an independent deep copy of the current cache for rollback. */
	snapshot(): Map<string, Task[]> {
		const snap = new Map<string, Task[]>();
		for (const [key, tasks] of this.cache) {
			snap.set(key, tasks.map((t) => t.clone()));
		}
		return snap;
	}

	/** Replace the current cache with a previously-captured snapshot. */
	restore(snapshot: Map<string, Task[]>): void {
		this.cache = snapshot;
	}

	/** Remove all data from the collection. */
	clear(): void {
		this.cache.clear();
	}
}
