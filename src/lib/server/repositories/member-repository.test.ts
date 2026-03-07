import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemberRepository } from './member-repository';
import type { MemberData, ThemeConfig } from '$lib/domain/types';
import * as schema from '$lib/server/db/schema';

// ── Test Helpers ────────────────────────────────────────

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

const playfulTheme: ThemeConfig = {
	variant: 'playful',
	accent: '#8b5cf6',
	accentLight: '#ede9fe',
	accentDark: '#4c1d95',
	headerBg: '#8b5cf6',
	ringColor: '#8b5cf6',
	checkColor: '#8b5cf6',
	emoji: '🦄'
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

function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });

	// Create the family_members table using raw SQL matching the schema
	db.run(sql`
		CREATE TABLE family_members (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			theme_variant TEXT NOT NULL DEFAULT 'default',
			theme_accent TEXT NOT NULL,
			theme_accent_light TEXT NOT NULL,
			theme_accent_dark TEXT NOT NULL,
			theme_header_bg TEXT NOT NULL,
			theme_ring_color TEXT NOT NULL,
			theme_check_color TEXT NOT NULL,
			theme_emoji TEXT NOT NULL DEFAULT '',
			quote_text TEXT NOT NULL DEFAULT '',
			quote_author TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`);

	return db;
}

// ── Tests ───────────────────────────────────────────────

describe('MemberRepository', () => {
	let db: ReturnType<typeof createTestDb>;
	let repo: MemberRepository;

	beforeEach(() => {
		db = createTestDb();
		repo = new MemberRepository(db);
	});

	// ── findById ──────────────────────────────────────

	describe('findById', () => {
		it('returns member with reconstructed theme and quote', () => {
			const data = makeMemberData();
			repo.insert(data);

			const found = repo.findById('member-1');

			expect(found).not.toBeNull();
			expect(found!.id).toBe('member-1');
			expect(found!.name).toBe('Alice');
			expect(found!.theme).toEqual(testTheme);
			expect(found!.quote).toEqual({ text: 'Hello world', author: 'Alice' });
			expect(found!.createdAt).toBe('2026-01-01T00:00:00.000Z');
			expect(found!.updatedAt).toBe('2026-01-01T00:00:00.000Z');
		});

		it('returns null for non-existent id', () => {
			const found = repo.findById('non-existent');
			expect(found).toBeNull();
		});

		it('reconstructs playful theme with emoji correctly', () => {
			const data = makeMemberData({
				id: 'member-2',
				theme: { ...playfulTheme }
			});
			repo.insert(data);

			const found = repo.findById('member-2');

			expect(found!.theme.variant).toBe('playful');
			expect(found!.theme.emoji).toBe('🦄');
			expect(found!.theme.accent).toBe('#8b5cf6');
		});
	});

	// ── findAll ───────────────────────────────────────

	describe('findAll', () => {
		it('returns all members with themes reconstructed', () => {
			repo.insert(makeMemberData({ id: 'member-1', name: 'Alice' }));
			repo.insert(
				makeMemberData({
					id: 'member-2',
					name: 'Bob',
					theme: { ...playfulTheme }
				})
			);

			const members = repo.findAll();

			expect(members).toHaveLength(2);
			expect(members[0].name).toBe('Alice');
			expect(members[0].theme).toEqual(testTheme);
			expect(members[1].name).toBe('Bob');
			expect(members[1].theme).toEqual(playfulTheme);
		});

		it('returns empty array when no members exist', () => {
			const members = repo.findAll();
			expect(members).toEqual([]);
		});
	});

	// ── count ─────────────────────────────────────────

	describe('count', () => {
		it('returns 0 for empty table', () => {
			expect(repo.count()).toBe(0);
		});

		it('returns correct count after inserts', () => {
			repo.insert(makeMemberData({ id: 'member-1' }));
			repo.insert(makeMemberData({ id: 'member-2' }));
			repo.insert(makeMemberData({ id: 'member-3' }));

			expect(repo.count()).toBe(3);
		});
	});

	// ── insert ────────────────────────────────────────

	describe('insert', () => {
		it('stores member with denormalized theme columns', () => {
			const data = makeMemberData();
			repo.insert(data);

			// Verify by reading back via findById
			const found = repo.findById('member-1');
			expect(found).not.toBeNull();
			expect(found!.id).toBe('member-1');
			expect(found!.name).toBe('Alice');
			expect(found!.theme).toEqual(testTheme);
			expect(found!.quote).toEqual({ text: 'Hello world', author: 'Alice' });
		});

		it('stores all theme fields correctly', () => {
			const data = makeMemberData({
				id: 'member-full',
				theme: {
					variant: 'playful',
					accent: '#ec4899',
					accentLight: '#fce7f3',
					accentDark: '#831843',
					headerBg: '#ec4899',
					ringColor: '#ec4899',
					checkColor: '#ec4899',
					emoji: '🌸'
				},
				quote: { text: 'Be brave', author: 'Someone' }
			});
			repo.insert(data);

			const found = repo.findById('member-full');
			expect(found!.theme.variant).toBe('playful');
			expect(found!.theme.accent).toBe('#ec4899');
			expect(found!.theme.accentLight).toBe('#fce7f3');
			expect(found!.theme.accentDark).toBe('#831843');
			expect(found!.theme.headerBg).toBe('#ec4899');
			expect(found!.theme.ringColor).toBe('#ec4899');
			expect(found!.theme.checkColor).toBe('#ec4899');
			expect(found!.theme.emoji).toBe('🌸');
			expect(found!.quote.text).toBe('Be brave');
			expect(found!.quote.author).toBe('Someone');
		});
	});

	// ── update ────────────────────────────────────────

	describe('update', () => {
		it('modifies all fields including theme', () => {
			repo.insert(makeMemberData());

			const updatedData = makeMemberData({
				name: 'Alice Updated',
				theme: { ...playfulTheme },
				quote: { text: 'New quote', author: 'New author' },
				updatedAt: '2026-06-01T00:00:00.000Z'
			});
			repo.update(updatedData);

			const found = repo.findById('member-1');
			expect(found!.name).toBe('Alice Updated');
			expect(found!.theme).toEqual(playfulTheme);
			expect(found!.quote).toEqual({ text: 'New quote', author: 'New author' });
			expect(found!.updatedAt).toBe('2026-06-01T00:00:00.000Z');
			// createdAt should remain unchanged
			expect(found!.createdAt).toBe('2026-01-01T00:00:00.000Z');
		});

		it('updates theme emoji from empty to emoji', () => {
			repo.insert(makeMemberData());

			const updatedData = makeMemberData({
				theme: { ...testTheme, emoji: '🚀' }
			});
			repo.update(updatedData);

			const found = repo.findById('member-1');
			expect(found!.theme.emoji).toBe('🚀');
		});
	});

	// ── updatePartial ─────────────────────────────────

	describe('updatePartial', () => {
		it('updates only name when theme is not provided', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', { name: 'Bob' });

			const found = repo.findById('member-1');
			expect(found!.name).toBe('Bob');
			// Theme should remain unchanged
			expect(found!.theme).toEqual(testTheme);
		});

		it('denormalizes theme object when provided', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', { theme: { ...playfulTheme } });

			const found = repo.findById('member-1');
			expect(found!.theme).toEqual(playfulTheme);
			// Name should remain unchanged
			expect(found!.name).toBe('Alice');
		});

		it('denormalizes quote object when provided', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', {
				quote: { text: 'Updated quote', author: 'Updated author' }
			});

			const found = repo.findById('member-1');
			expect(found!.quote).toEqual({ text: 'Updated quote', author: 'Updated author' });
			expect(found!.name).toBe('Alice');
		});

		it('handles theme and name together', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', {
				name: 'Bob',
				theme: { ...playfulTheme }
			});

			const found = repo.findById('member-1');
			expect(found!.name).toBe('Bob');
			expect(found!.theme).toEqual(playfulTheme);
		});

		it('handles all three: name, theme, and quote', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', {
				name: 'Bob',
				theme: { ...playfulTheme },
				quote: { text: 'New', author: 'Author' }
			});

			const found = repo.findById('member-1');
			expect(found!.name).toBe('Bob');
			expect(found!.theme).toEqual(playfulTheme);
			expect(found!.quote).toEqual({ text: 'New', author: 'Author' });
		});

		it('passes through simple fields without theme/quote', () => {
			repo.insert(makeMemberData());

			repo.updatePartial('member-1', {
				name: 'Charlie',
				updatedAt: '2026-06-15T00:00:00.000Z'
			});

			const found = repo.findById('member-1');
			expect(found!.name).toBe('Charlie');
			expect(found!.updatedAt).toBe('2026-06-15T00:00:00.000Z');
		});
	});

	// ── delete ────────────────────────────────────────

	describe('delete', () => {
		it('removes a member', () => {
			repo.insert(makeMemberData());
			expect(repo.count()).toBe(1);

			repo.delete('member-1');

			expect(repo.count()).toBe(0);
			expect(repo.findById('member-1')).toBeNull();
		});

		it('does not throw when deleting non-existent member', () => {
			expect(() => repo.delete('non-existent')).not.toThrow();
		});

		it('only deletes the targeted member', () => {
			repo.insert(makeMemberData({ id: 'member-1', name: 'Alice' }));
			repo.insert(makeMemberData({ id: 'member-2', name: 'Bob' }));

			repo.delete('member-1');

			expect(repo.count()).toBe(1);
			expect(repo.findById('member-1')).toBeNull();
			expect(repo.findById('member-2')).not.toBeNull();
		});
	});
});
