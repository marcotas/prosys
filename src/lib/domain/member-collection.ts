import type { Member } from './member';

/**
 * Manages a flat `Map<string, Member>` cache keyed by member ID.
 *
 * Unlike TaskCollection/HabitCollection which group entities by composite keys,
 * MemberCollection is a simple ID-keyed lookup. Supports stateful queries,
 * mutations, and snapshot/restore for optimistic update rollback.
 * Does NOT notify -- controllers handle that.
 */
export class MemberCollection {
	private cache = new Map<string, Member>();

	/** Merge members into the cache (additive -- does not clear existing). */
	hydrate(members: Member[]): void {
		for (const member of members) {
			this.cache.set(member.id, member);
		}
	}

	/** Retrieve a member by ID. Returns undefined if not found. */
	getById(id: string): Member | undefined {
		return this.cache.get(id);
	}

	/** Return all members in the collection. */
	getAll(): Member[] {
		return Array.from(this.cache.values());
	}

	/** Insert or replace a member. */
	insert(member: Member): void {
		this.cache.set(member.id, member);
	}

	/** Remove a member by ID. Returns true if found and removed. */
	remove(id: string): boolean {
		return this.cache.delete(id);
	}

	/** Apply an updater function to an existing member. No-op if not found. */
	update(id: string, updater: (member: Member) => void): void {
		const member = this.cache.get(id);
		if (member) updater(member);
	}

	/** The number of members in the collection. */
	get size(): number {
		return this.cache.size;
	}

	/** Create an independent deep copy of the current cache for rollback. */
	snapshot(): Map<string, Member> {
		const snap = new Map<string, Member>();
		for (const [id, member] of this.cache) {
			snap.set(id, member.clone());
		}
		return snap;
	}

	/** Replace the current cache with a previously-captured snapshot. */
	restore(snapshot: Map<string, Member>): void {
		this.cache = snapshot;
	}

	/** Remove all data from the collection. */
	clear(): void {
		this.cache.clear();
	}
}
