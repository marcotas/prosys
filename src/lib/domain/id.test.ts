import { describe, it, expect } from 'vitest';
import { ID } from './id';

// ── Crockford Base32 alphabet ────────────────────────────
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ── generate() ───────────────────────────────────────────

describe('ID.generate', () => {
	it('produces a 26-character string', () => {
		const id = ID.generate();
		expect(id.toString()).toHaveLength(26);
	});

	it('uses only Crockford Base32 characters', () => {
		const id = ID.generate();
		for (const ch of id.toString()) {
			expect(CROCKFORD).toContain(ch);
		}
	});

	it('generates unique IDs', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(ID.generate().toString());
		}
		expect(ids.size).toBe(100);
	});

	it('encodes the current timestamp in the first 10 characters', () => {
		const before = Date.now();
		const id = ID.generate();
		const after = Date.now();

		// Decode first 10 chars as Crockford Base32 timestamp
		const raw = id.toString();
		let timestamp = 0;
		for (let i = 0; i < 10; i++) {
			timestamp = timestamp * 32 + CROCKFORD.indexOf(raw[i]);
		}

		expect(timestamp).toBeGreaterThanOrEqual(before);
		expect(timestamp).toBeLessThanOrEqual(after);
	});
});

// ── from() ───────────────────────────────────────────────

describe('ID.from', () => {
	it('accepts a valid 26-char Crockford Base32 string', () => {
		const valid = '01AN4Z07BY79KA1307SR9X4MV3';
		const id = ID.from(valid);
		expect(id.toString()).toBe(valid);
	});

	it('rejects strings shorter than 26 characters', () => {
		expect(() => ID.from('01AN4Z07BY79KA130')).toThrow('Invalid ULID');
	});

	it('rejects strings longer than 26 characters', () => {
		expect(() => ID.from('01AN4Z07BY79KA1307SR9X4MV3X')).toThrow('Invalid ULID');
	});

	it('rejects strings with invalid characters (lowercase)', () => {
		expect(() => ID.from('01an4z07by79ka1307sr9x4mv3')).toThrow('Invalid ULID');
	});

	it('rejects strings with characters outside Crockford Base32', () => {
		// 'I', 'L', 'O', 'U' are NOT in Crockford alphabet
		expect(() => ID.from('01AN4Z07BY79KA1307SR9X4MVI')).toThrow('Invalid ULID');
		expect(() => ID.from('01AN4Z07BY79KA1307SR9X4MVL')).toThrow('Invalid ULID');
		expect(() => ID.from('01AN4Z07BY79KA1307SR9X4MVO')).toThrow('Invalid ULID');
		expect(() => ID.from('01AN4Z07BY79KA1307SR9X4MVU')).toThrow('Invalid ULID');
	});

	it('rejects empty strings', () => {
		expect(() => ID.from('')).toThrow('Invalid ULID');
	});
});

// ── toString() ───────────────────────────────────────────

describe('ID.toString', () => {
	it('returns the underlying ULID string', () => {
		const raw = '01AN4Z07BY79KA1307SR9X4MV3';
		const id = ID.from(raw);
		expect(id.toString()).toBe(raw);
	});

	it('round-trips through generate and toString', () => {
		const id = ID.generate();
		const raw = id.toString();
		expect(raw).toHaveLength(26);
		const restored = ID.from(raw);
		expect(restored.toString()).toBe(raw);
	});
});

// ── equals() ─────────────────────────────────────────────

describe('ID.equals', () => {
	it('returns true for IDs with the same value', () => {
		const raw = '01AN4Z07BY79KA1307SR9X4MV3';
		const a = ID.from(raw);
		const b = ID.from(raw);
		expect(a.equals(b)).toBe(true);
	});

	it('returns false for IDs with different values', () => {
		const a = ID.generate();
		const b = ID.generate();
		expect(a.equals(b)).toBe(false);
	});
});

// ── encodeTime edge cases ────────────────────────────────

describe('ID.generate encodeTime edge cases', () => {
	it('throws when timestamp is negative', () => {
		const original = Date.now;
		Date.now = () => -1;
		try {
			expect(() => ID.generate()).toThrow('Timestamp out of range');
		} finally {
			Date.now = original;
		}
	});

	it('throws when timestamp exceeds max ULID time', () => {
		const original = Date.now;
		// 32^10 = 1099511627776, exceeds max encodable time
		Date.now = () => 32 ** 10;
		try {
			expect(() => ID.generate()).toThrow('Timestamp out of range');
		} finally {
			Date.now = original;
		}
	});
});

// ── Sortability ──────────────────────────────────────────

describe('ID sortability', () => {
	it('sorts chronologically by string comparison', async () => {
		const first = ID.generate();
		// Small delay to ensure different timestamp
		await new Promise((r) => setTimeout(r, 2));
		const second = ID.generate();

		expect(first.toString() < second.toString()).toBe(true);
	});

	it('sorts an array of IDs in chronological order', async () => {
		const ids: ID[] = [];
		for (let i = 0; i < 5; i++) {
			ids.push(ID.generate());
			await new Promise((r) => setTimeout(r, 2));
		}

		const strings = ids.map((id) => id.toString());
		const sorted = [...strings].sort();
		expect(strings).toEqual(sorted);
	});
});
