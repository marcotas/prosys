# Step 7: Member Entity Class

> Member entity with nested objects (theme, quote). Requires deep-copy in `fromData()`, `toJSON()`, `clone()`. Mutations auto-update `updatedAt`.

**Files:**
- Create: `src/lib/domain/member.ts`
- Create: `src/lib/domain/member.test.ts`

**Dependencies:** Step 1 (types with `MemberData`)

---

## Step 1: Write the failing test

Create `src/lib/domain/member.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
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

const validInput = {
	name: 'Alice',
	theme: testTheme,
	quote: { text: 'Hello world', author: 'Alice' }
};

function makeMemberData(overrides: Partial<MemberData> = {}): MemberData {
	return {
		id: 'member-1',
		name: 'Alice',
		theme: { ...testTheme },
		quote: { text: 'Hello world', author: 'Alice' },
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

afterEach(() => {
	vi.useRealTimers();
});

// ── create() ─────────────────────────────────────────────

describe('Member.create', () => {
	it('creates a member with valid input', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

		const member = Member.create(validInput);

		expect(member.id).toBeTruthy();
		expect(member.name).toBe('Alice');
		expect(member.theme).toEqual(testTheme);
		expect(member.quote).toEqual({ text: 'Hello world', author: 'Alice' });
		expect(member.createdAt).toBe('2026-03-01T12:00:00.000Z');
		expect(member.updatedAt).toBe('2026-03-01T12:00:00.000Z');
	});

	it('generates a unique id', () => {
		const m1 = Member.create(validInput);
		const m2 = Member.create(validInput);
		expect(m1.id).not.toBe(m2.id);
	});

	it('trims whitespace from name', () => {
		const member = Member.create({ ...validInput, name: '  Alice  ' });
		expect(member.name).toBe('Alice');
	});

	it('deep-copies theme (no shared references)', () => {
		const theme = { ...testTheme };
		const member = Member.create({ ...validInput, theme });
		theme.accent = '#000000';
		expect(member.theme.accent).toBe('#4a7c59');
	});

	it('deep-copies quote (no shared references)', () => {
		const quote = { text: 'Hello', author: 'Alice' };
		const member = Member.create({ ...validInput, quote });
		quote.text = 'Changed';
		expect(member.quote.text).toBe('Hello');
	});

	it('throws on empty name', () => {
		expect(() => Member.create({ ...validInput, name: '' })).toThrow('Name is required');
	});

	it('throws on whitespace-only name', () => {
		expect(() => Member.create({ ...validInput, name: '   ' })).toThrow('Name is required');
	});
});

// ── fromData() ───────────────────────────────────────────

describe('Member.fromData', () => {
	it('hydrates all fields from data', () => {
		const data = makeMemberData();
		const member = Member.fromData(data);

		expect(member.id).toBe('member-1');
		expect(member.name).toBe('Alice');
		expect(member.theme).toEqual(testTheme);
		expect(member.quote).toEqual({ text: 'Hello world', author: 'Alice' });
		expect(member.createdAt).toBe('2026-01-01T00:00:00.000Z');
		expect(member.updatedAt).toBe('2026-01-01T00:00:00.000Z');
	});

	it('does not validate (trusted hydration)', () => {
		const data = makeMemberData({ name: '' });
		const member = Member.fromData(data);
		expect(member.name).toBe('');
	});

	it('creates independent copies of nested objects', () => {
		const data = makeMemberData();
		const member = Member.fromData(data);
		data.theme.accent = '#000000';
		data.quote.text = 'Changed';
		expect(member.theme.accent).toBe('#4a7c59');
		expect(member.quote.text).toBe('Hello world');
	});
});

// ── Mutations ────────────────────────────────────────────

describe('Member mutations', () => {
	it('updateName() updates the name and updatedAt', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const member = Member.fromData(makeMemberData());

		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		member.updateName('Bob');

		expect(member.name).toBe('Bob');
		expect(member.updatedAt).toBe('2026-06-01T12:00:00.000Z');
		expect(member.createdAt).toBe('2026-01-01T00:00:00.000Z'); // unchanged
	});

	it('updateName() trims whitespace', () => {
		const member = Member.fromData(makeMemberData());
		member.updateName('  Bob  ');
		expect(member.name).toBe('Bob');
	});

	it('updateName() throws on empty string', () => {
		const member = Member.fromData(makeMemberData());
		expect(() => member.updateName('')).toThrow('Name cannot be empty');
	});

	it('updateName() throws on whitespace-only', () => {
		const member = Member.fromData(makeMemberData());
		expect(() => member.updateName('   ')).toThrow('Name cannot be empty');
	});

	it('updateTheme() updates theme and updatedAt', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const member = Member.fromData(makeMemberData());

		const newTheme: ThemeConfig = {
			...testTheme,
			variant: 'playful',
			accent: '#8b5cf6',
			emoji: '🦄'
		};

		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		member.updateTheme(newTheme);

		expect(member.theme.variant).toBe('playful');
		expect(member.theme.accent).toBe('#8b5cf6');
		expect(member.updatedAt).toBe('2026-06-01T12:00:00.000Z');
	});

	it('updateTheme() deep-copies (no shared references)', () => {
		const member = Member.fromData(makeMemberData());
		const newTheme = { ...testTheme, accent: '#ff0000' };
		member.updateTheme(newTheme);
		newTheme.accent = '#00ff00';
		expect(member.theme.accent).toBe('#ff0000');
	});

	it('updateQuote() updates quote and updatedAt', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const member = Member.fromData(makeMemberData());

		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		member.updateQuote({ text: 'New quote', author: 'Bob' });

		expect(member.quote).toEqual({ text: 'New quote', author: 'Bob' });
		expect(member.updatedAt).toBe('2026-06-01T12:00:00.000Z');
	});

	it('updateQuote() deep-copies (no shared references)', () => {
		const member = Member.fromData(makeMemberData());
		const newQuote = { text: 'Test', author: 'Test' };
		member.updateQuote(newQuote);
		newQuote.text = 'Changed';
		expect(member.quote.text).toBe('Test');
	});
});

// ── Serialization ────────────────────────────────────────

describe('Member serialization', () => {
	it('toJSON() returns plain data matching the input', () => {
		const data = makeMemberData();
		const member = Member.fromData(data);
		expect(member.toJSON()).toEqual(data);
	});

	it('toJSON() returns independent copies of nested objects', () => {
		const member = Member.fromData(makeMemberData());
		const json = member.toJSON();
		json.theme.accent = '#000000';
		json.quote.text = 'Changed';
		expect(member.theme.accent).toBe('#4a7c59');
		expect(member.quote.text).toBe('Hello world');
	});

	it('clone() returns an independent deep copy', () => {
		const member = Member.fromData(makeMemberData());
		const cloned = member.clone();

		expect(cloned.toJSON()).toEqual(member.toJSON());

		cloned.updateName('Different');
		expect(member.name).toBe('Alice');
		expect(cloned.name).toBe('Different');
	});

	it('clone() creates independent nested objects', () => {
		const member = Member.fromData(makeMemberData());
		const cloned = member.clone();

		cloned.updateTheme({ ...testTheme, accent: '#000000' });
		expect(member.theme.accent).toBe('#4a7c59');
	});
});
```

## Step 2: Run test to verify it fails

Run: `pnpm test src/lib/domain/member.test.ts`

Expected: FAIL — `member.ts` does not exist.

## Step 3: Write the implementation

Create `src/lib/domain/member.ts`:

```ts
import type { MemberData, CreateMemberInput, ThemeConfig } from './types';

export class Member {
	private constructor(private data: MemberData) {}

	static create(input: CreateMemberInput): Member {
		const errors: string[] = [];

		if (!input.name?.trim()) errors.push('Name is required');

		if (errors.length > 0) throw new Error(errors.join('; '));

		const now = new Date().toISOString();
		return new Member({
			id: crypto.randomUUID(),
			name: input.name.trim(),
			theme: { ...input.theme },
			quote: { ...input.quote },
			createdAt: now,
			updatedAt: now
		});
	}

	static fromData(data: MemberData): Member {
		return new Member({
			...data,
			theme: { ...data.theme },
			quote: { ...data.quote }
		});
	}

	// ── Getters ──────────────────────────────────────────

	get id(): string {
		return this.data.id;
	}
	get name(): string {
		return this.data.name;
	}
	get theme(): ThemeConfig {
		return this.data.theme;
	}
	get quote(): { text: string; author: string } {
		return this.data.quote;
	}
	get createdAt(): string {
		return this.data.createdAt;
	}
	get updatedAt(): string {
		return this.data.updatedAt;
	}

	// ── Mutations ────────────────────────────────────────

	updateName(name: string): void {
		if (!name.trim()) throw new Error('Name cannot be empty');
		this.data.name = name.trim();
		this.data.updatedAt = new Date().toISOString();
	}

	updateTheme(theme: ThemeConfig): void {
		this.data.theme = { ...theme };
		this.data.updatedAt = new Date().toISOString();
	}

	updateQuote(quote: { text: string; author: string }): void {
		this.data.quote = { ...quote };
		this.data.updatedAt = new Date().toISOString();
	}

	// ── Serialization ────────────────────────────────────

	toJSON(): MemberData {
		return {
			...this.data,
			theme: { ...this.data.theme },
			quote: { ...this.data.quote }
		};
	}

	clone(): Member {
		return Member.fromData(this.toJSON());
	}
}
```

## Step 4: Run test to verify it passes

Run: `pnpm test src/lib/domain/member.test.ts`

Expected: All tests PASS.

## Step 5: Commit

```bash
git add src/lib/domain/member.ts src/lib/domain/member.test.ts
git commit -m "feat: add Member entity class with tests"
```
