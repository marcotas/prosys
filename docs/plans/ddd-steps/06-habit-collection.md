# Step 6: HabitCollection Class

> Manages a `Map<string, Habit[]>` cache keyed by memberId. Similar pattern to TaskCollection but simpler — no dayIndex filtering.

**Files:**
- Create: `src/lib/domain/habit-collection.ts`
- Create: `src/lib/domain/habit-collection.test.ts`

**Dependencies:** Step 5 (Habit entity class)

---

## Step 1: Write the failing test

Create `src/lib/domain/habit-collection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HabitCollection } from './habit-collection';
import { Habit } from './habit';
import type { HabitData } from './types';

// ── Helpers ──────────────────────────────────────────────

function makeHabitData(overrides: Partial<HabitData> = {}): HabitData {
	return {
		id: 'habit-1',
		memberId: 'member-1',
		name: 'Read',
		sortOrder: 0,
		...overrides
	};
}

function makeHabit(overrides: Partial<HabitData> = {}): Habit {
	return Habit.fromData(makeHabitData(overrides));
}

const MEMBER = 'member-1';

// ── hydrate / has ────────────────────────────────────────

describe('HabitCollection hydration', () => {
	it('has() returns false for unknown memberId', () => {
		const col = new HabitCollection();
		expect(col.has('unknown')).toBe(false);
	});

	it('hydrate() stores habits and has() returns true', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit()]);
		expect(col.has(MEMBER)).toBe(true);
	});

	it('hydrate() replaces existing habits for same member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })]);
		col.hydrate(MEMBER, [makeHabit({ id: 'c' })]);
		expect(col.getAll(MEMBER)).toHaveLength(1);
	});
});

// ── getAll ───────────────────────────────────────────────

describe('HabitCollection.getAll', () => {
	it('returns empty array for unknown member', () => {
		const col = new HabitCollection();
		expect(col.getAll('unknown')).toEqual([]);
	});

	it('returns habits sorted by sortOrder', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'c', sortOrder: 2 }),
			makeHabit({ id: 'a', sortOrder: 0 }),
			makeHabit({ id: 'b', sortOrder: 1 })
		]);
		const habits = col.getAll(MEMBER);
		expect(habits.map(h => h.id)).toEqual(['a', 'b', 'c']);
	});
});

// ── findById ─────────────────────────────────────────────

describe('HabitCollection.findById', () => {
	it('finds a habit across any member', () => {
		const col = new HabitCollection();
		col.hydrate('m1', [makeHabit({ id: 'a', memberId: 'm1' })]);
		col.hydrate('m2', [makeHabit({ id: 'b', memberId: 'm2' })]);
		expect(col.findById('b')?.id).toBe('b');
	});

	it('returns undefined for unknown id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		expect(col.findById('unknown')).toBeUndefined();
	});
});

// ── insert ───────────────────────────────────────────────

describe('HabitCollection.insert', () => {
	it('inserts into existing member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		col.insert(MEMBER, makeHabit({ id: 'b' }));
		expect(col.getAll(MEMBER)).toHaveLength(2);
	});

	it('creates member key if it does not exist', () => {
		const col = new HabitCollection();
		col.insert(MEMBER, makeHabit({ id: 'a' }));
		expect(col.has(MEMBER)).toBe(true);
	});
});

// ── remove ───────────────────────────────────────────────

describe('HabitCollection.remove', () => {
	it('removes a habit by id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' }), makeHabit({ id: 'b' })]);
		expect(col.remove('a')).toBe(true);
		expect(col.getAll(MEMBER)).toHaveLength(1);
		expect(col.findById('a')).toBeUndefined();
	});

	it('returns false for unknown id', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a' })]);
		expect(col.remove('unknown')).toBe(false);
	});
});

// ── reorder ──────────────────────────────────────────────

describe('HabitCollection.reorder', () => {
	it('sets sortOrder based on position in habitIds', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'a', sortOrder: 0 }),
			makeHabit({ id: 'b', sortOrder: 1 }),
			makeHabit({ id: 'c', sortOrder: 2 })
		]);

		col.reorder(MEMBER, ['c', 'a', 'b']);
		const habits = col.getAll(MEMBER);
		expect(habits.map(h => h.id)).toEqual(['c', 'a', 'b']);
	});

	it('does nothing for unknown member', () => {
		const col = new HabitCollection();
		col.reorder('unknown', ['a', 'b']); // should not throw
	});
});

// ── nextSortOrder ────────────────────────────────────────

describe('HabitCollection.nextSortOrder', () => {
	it('returns 0 for empty member', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, []);
		expect(col.nextSortOrder(MEMBER)).toBe(0);
	});

	it('returns max + 1 for existing habits', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [
			makeHabit({ id: 'a', sortOrder: 2 }),
			makeHabit({ id: 'b', sortOrder: 5 })
		]);
		expect(col.nextSortOrder(MEMBER)).toBe(6);
	});

	it('returns 0 for unknown member', () => {
		const col = new HabitCollection();
		expect(col.nextSortOrder('unknown')).toBe(0);
	});
});

// ── snapshot / restore ───────────────────────────────────

describe('HabitCollection snapshot/restore', () => {
	it('snapshot creates an independent deep copy', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a', name: 'Original' })]);

		const snap = col.snapshot();
		col.findById('a')!.updateName('Changed');

		const snapHabits = snap.get(MEMBER)!;
		expect(snapHabits[0].name).toBe('Original');
	});

	it('restore replaces current state with snapshot', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit({ id: 'a', name: 'Original' })]);

		const snap = col.snapshot();
		col.findById('a')!.updateName('Changed');

		col.restore(snap);
		expect(col.findById('a')!.name).toBe('Original');
	});
});

// ── clear ────────────────────────────────────────────────

describe('HabitCollection.clear', () => {
	it('removes all data', () => {
		const col = new HabitCollection();
		col.hydrate(MEMBER, [makeHabit()]);
		col.clear();
		expect(col.has(MEMBER)).toBe(false);
	});
});
```

## Step 2: Run test to verify it fails

Run: `pnpm test src/lib/domain/habit-collection.test.ts`

Expected: FAIL — `habit-collection.ts` does not exist.

## Step 3: Write the implementation

Create `src/lib/domain/habit-collection.ts`:

```ts
import { Habit } from './habit';

export class HabitCollection {
	private cache = new Map<string, Habit[]>();

	hydrate(memberId: string, habits: Habit[]): void {
		this.cache.set(memberId, habits);
	}

	has(memberId: string): boolean {
		return this.cache.has(memberId);
	}

	getAll(memberId: string): Habit[] {
		return (this.cache.get(memberId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
	}

	findById(habitId: string): Habit | undefined {
		for (const habits of this.cache.values()) {
			const found = habits.find((h) => h.id === habitId);
			if (found) return found;
		}
		return undefined;
	}

	insert(memberId: string, habit: Habit): void {
		const habits = this.cache.get(memberId) ?? [];
		habits.push(habit);
		this.cache.set(memberId, habits);
	}

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

	reorder(memberId: string, habitIds: string[]): void {
		const habits = this.cache.get(memberId);
		if (!habits) return;

		habitIds.forEach((id, index) => {
			const habit = habits.find((h) => h.id === id);
			if (habit) habit.setSortOrder(index);
		});
	}

	nextSortOrder(memberId: string): number {
		const habits = this.getAll(memberId);
		if (habits.length === 0) return 0;
		return Math.max(...habits.map((h) => h.sortOrder)) + 1;
	}

	snapshot(): Map<string, Habit[]> {
		const snap = new Map<string, Habit[]>();
		for (const [key, habits] of this.cache) {
			snap.set(
				key,
				habits.map((h) => h.clone())
			);
		}
		return snap;
	}

	restore(snapshot: Map<string, Habit[]>): void {
		this.cache = snapshot;
	}

	clear(): void {
		this.cache.clear();
	}
}
```

## Step 4: Run test to verify it passes

Run: `pnpm test src/lib/domain/habit-collection.test.ts`

Expected: All tests PASS.

## Step 5: Commit

```bash
git add src/lib/domain/habit-collection.ts src/lib/domain/habit-collection.test.ts
git commit -m "feat: add HabitCollection class with tests"
```
