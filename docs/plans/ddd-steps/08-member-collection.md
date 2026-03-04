# Step 8: MemberCollection Class

> Unlike TaskCollection/HabitCollection which use `Map<string, Entity[]>`, MemberCollection is a flat `Map<string, Member>` keyed by member ID. Simpler API — no group keys, no reorder, no nextSortOrder.

**Files:**
- Create: `src/lib/domain/member-collection.ts`
- Create: `src/lib/domain/member-collection.test.ts`

**Dependencies:** Step 7 (Member entity class)

---

## Step 1: Write the failing test

Create `src/lib/domain/member-collection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MemberCollection } from './member-collection';
import { Member } from './member';
import type { MemberData, ThemeConfig } from './types';

// ── Helpers ──────────────────────────────────────────────

const testTheme: ThemeConfig = {
	variant: 'default',
	accent: '#4a7c59',
	accentLight: '#dcfce7',
	accentDark: '#1e3a24',
	headerBg: '#4a7c59',
	ringColor: '#4a7c59',
	checkColor: '#4a7c59',
	emoji: ''
};

function makeMemberData(overrides: Partial<MemberData> = {}): MemberData {
	return {
		id: 'member-1',
		name: 'Alice',
		theme: { ...testTheme },
		quote: { text: 'Hello', author: 'Alice' },
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

function makeMember(overrides: Partial<MemberData> = {}): Member {
	return Member.fromData(makeMemberData(overrides));
}

// ── hydrate ──────────────────────────────────────────────

describe('MemberCollection hydration', () => {
	it('hydrate() stores members by id', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a' }), makeMember({ id: 'b' })]);
		expect(col.getById('a')?.id).toBe('a');
		expect(col.getById('b')?.id).toBe('b');
	});

	it('hydrate() adds to existing members (does not clear)', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a' })]);
		col.hydrate([makeMember({ id: 'b' })]);
		expect(col.size).toBe(2);
	});
});

// ── getById / getAll ─────────────────────────────────────

describe('MemberCollection queries', () => {
	it('getById() returns undefined for unknown id', () => {
		const col = new MemberCollection();
		expect(col.getById('unknown')).toBeUndefined();
	});

	it('getById() returns the member', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a', name: 'Alice' })]);
		expect(col.getById('a')?.name).toBe('Alice');
	});

	it('getAll() returns all members', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a' }), makeMember({ id: 'b' })]);
		expect(col.getAll()).toHaveLength(2);
	});

	it('getAll() returns empty array when empty', () => {
		const col = new MemberCollection();
		expect(col.getAll()).toEqual([]);
	});

	it('size returns the count', () => {
		const col = new MemberCollection();
		expect(col.size).toBe(0);
		col.hydrate([makeMember({ id: 'a' }), makeMember({ id: 'b' })]);
		expect(col.size).toBe(2);
	});
});

// ── insert ───────────────────────────────────────────────

describe('MemberCollection.insert', () => {
	it('inserts a member', () => {
		const col = new MemberCollection();
		col.insert(makeMember({ id: 'a' }));
		expect(col.getById('a')?.id).toBe('a');
		expect(col.size).toBe(1);
	});

	it('replaces member with same id', () => {
		const col = new MemberCollection();
		col.insert(makeMember({ id: 'a', name: 'Alice' }));
		col.insert(makeMember({ id: 'a', name: 'Bob' }));
		expect(col.size).toBe(1);
		expect(col.getById('a')?.name).toBe('Bob');
	});
});

// ── remove ───────────────────────────────────────────────

describe('MemberCollection.remove', () => {
	it('removes a member by id', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a' }), makeMember({ id: 'b' })]);
		expect(col.remove('a')).toBe(true);
		expect(col.size).toBe(1);
		expect(col.getById('a')).toBeUndefined();
	});

	it('returns false for unknown id', () => {
		const col = new MemberCollection();
		expect(col.remove('unknown')).toBe(false);
	});
});

// ── update ───────────────────────────────────────────────

describe('MemberCollection.update', () => {
	it('applies updater to existing member', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a', name: 'Alice' })]);
		col.update('a', (m) => m.updateName('Bob'));
		expect(col.getById('a')?.name).toBe('Bob');
	});

	it('does nothing for unknown id', () => {
		const col = new MemberCollection();
		// Should not throw
		col.update('unknown', (m) => m.updateName('Bob'));
	});
});

// ── snapshot / restore ───────────────────────────────────

describe('MemberCollection snapshot/restore', () => {
	it('snapshot creates an independent deep copy', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a', name: 'Alice' })]);

		const snap = col.snapshot();
		col.getById('a')!.updateName('Changed');

		const snapMember = snap.get('a')!;
		expect(snapMember.name).toBe('Alice');
	});

	it('restore replaces current state with snapshot', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a', name: 'Alice' })]);

		const snap = col.snapshot();
		col.getById('a')!.updateName('Changed');

		col.restore(snap);
		expect(col.getById('a')!.name).toBe('Alice');
	});
});

// ── clear ────────────────────────────────────────────────

describe('MemberCollection.clear', () => {
	it('removes all data', () => {
		const col = new MemberCollection();
		col.hydrate([makeMember({ id: 'a' })]);
		col.clear();
		expect(col.size).toBe(0);
		expect(col.getAll()).toEqual([]);
	});
});
```

## Step 2: Run test to verify it fails

Run: `pnpm test src/lib/domain/member-collection.test.ts`

Expected: FAIL — `member-collection.ts` does not exist.

## Step 3: Write the implementation

Create `src/lib/domain/member-collection.ts`:

```ts
import { Member } from './member';

export class MemberCollection {
	private cache = new Map<string, Member>();

	hydrate(members: Member[]): void {
		for (const member of members) {
			this.cache.set(member.id, member);
		}
	}

	getById(id: string): Member | undefined {
		return this.cache.get(id);
	}

	getAll(): Member[] {
		return Array.from(this.cache.values());
	}

	insert(member: Member): void {
		this.cache.set(member.id, member);
	}

	remove(id: string): boolean {
		return this.cache.delete(id);
	}

	update(id: string, updater: (member: Member) => void): void {
		const member = this.cache.get(id);
		if (member) updater(member);
	}

	get size(): number {
		return this.cache.size;
	}

	snapshot(): Map<string, Member> {
		const snap = new Map<string, Member>();
		for (const [id, member] of this.cache) {
			snap.set(id, member.clone());
		}
		return snap;
	}

	restore(snapshot: Map<string, Member>): void {
		this.cache = snapshot;
	}

	clear(): void {
		this.cache.clear();
	}
}
```

## Step 4: Run test to verify it passes

Run: `pnpm test src/lib/domain/member-collection.test.ts`

Expected: All tests PASS.

## Step 5: Commit

```bash
git add src/lib/domain/member-collection.ts src/lib/domain/member-collection.test.ts
git commit -m "feat: add MemberCollection class with tests"
```
