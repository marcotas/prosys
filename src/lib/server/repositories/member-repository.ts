import { eq, sql } from 'drizzle-orm';
import { familyMembers } from '$lib/server/db/schema';
import { db as defaultDb } from '$lib/server/db';
import type { MemberData, ThemeConfig, ThemeVariant } from '$lib/domain/types';

type Db = typeof defaultDb;
type MemberRow = typeof familyMembers.$inferSelect;

// ── Row <-> MemberData mapping ──────────────────────────

function rowToMemberData(row: MemberRow): MemberData {
	return {
		id: row.id,
		name: row.name,
		theme: {
			variant: row.themeVariant as ThemeVariant,
			accent: row.themeAccent,
			accentLight: row.themeAccentLight,
			accentDark: row.themeAccentDark,
			headerBg: row.themeHeaderBg,
			ringColor: row.themeRingColor,
			checkColor: row.themeCheckColor,
			emoji: row.themeEmoji
		},
		quote: {
			text: row.quoteText,
			author: row.quoteAuthor
		},
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function themeToColumns(theme: ThemeConfig): Record<string, string> {
	return {
		themeVariant: theme.variant,
		themeAccent: theme.accent,
		themeAccentLight: theme.accentLight,
		themeAccentDark: theme.accentDark,
		themeHeaderBg: theme.headerBg,
		themeRingColor: theme.ringColor,
		themeCheckColor: theme.checkColor,
		themeEmoji: theme.emoji
	};
}

function quoteToColumns(quote: { text: string; author: string }): Record<string, string> {
	return {
		quoteText: quote.text,
		quoteAuthor: quote.author
	};
}

// ── Repository ──────────────────────────────────────────

export class MemberRepository {
	constructor(private readonly db: Db) {}

	findById(id: string): MemberData | null {
		const row = this.db.select().from(familyMembers).where(eq(familyMembers.id, id)).get();
		return row ? rowToMemberData(row) : null;
	}

	findAll(): MemberData[] {
		const rows = this.db.select().from(familyMembers).all();
		return rows.map(rowToMemberData);
	}

	count(): number {
		const result = this.db
			.select({ count: sql<number>`count(*)` })
			.from(familyMembers)
			.get();
		return result?.count ?? 0;
	}

	insert(data: MemberData): void {
		this.db
			.insert(familyMembers)
			.values({
				id: data.id,
				name: data.name,
				...themeToColumns(data.theme),
				...quoteToColumns(data.quote),
				createdAt: data.createdAt,
				updatedAt: data.updatedAt
			})
			.run();
	}

	update(data: MemberData): void {
		this.db
			.update(familyMembers)
			.set({
				name: data.name,
				...themeToColumns(data.theme),
				...quoteToColumns(data.quote),
				updatedAt: data.updatedAt
			})
			.where(eq(familyMembers.id, data.id))
			.run();
	}

	updatePartial(id: string, fields: Record<string, unknown>): void {
		const updates: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(fields)) {
			if (key === 'theme' && value && typeof value === 'object') {
				Object.assign(updates, themeToColumns(value as ThemeConfig));
			} else if (key === 'quote' && value && typeof value === 'object') {
				Object.assign(updates, quoteToColumns(value as { text: string; author: string }));
			} else {
				updates[key] = value;
			}
		}

		this.db
			.update(familyMembers)
			.set(updates)
			.where(eq(familyMembers.id, id))
			.run();
	}

	delete(id: string): void {
		this.db.delete(familyMembers).where(eq(familyMembers.id, id)).run();
	}
}

// ── Singleton export ────────────────────────────────────

export const memberRepository = new MemberRepository(defaultDb);
