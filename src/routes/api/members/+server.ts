import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { familyMembers } from '$lib/server/db/schema';
import { createId } from '$lib/utils/ids';
import type { Member, ThemeConfig, ThemeVariant } from '$lib/types';

// ── Helpers ─────────────────────────────────────────────

function rowToMember(row: typeof familyMembers.$inferSelect): Member {
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
		quote: { text: row.quoteText, author: row.quoteAuthor },
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

// ── Seed data ───────────────────────────────────────────

const seedMembers: { name: string; theme: ThemeConfig; quote: { text: string; author: string } }[] = [
	{
		name: 'Marco',
		theme: {
			variant: 'default',
			accent: '#4a7c59',
			accentLight: '#dcfce7',
			accentDark: '#1e3a24',
			headerBg: '#4a7c59',
			ringColor: '#4a7c59',
			checkColor: '#4a7c59',
			emoji: ''
		},
		quote: { text: 'Tiny Changes, Remarkable Results', author: 'James Clear' }
	},
	{
		name: 'Alice',
		theme: {
			variant: 'playful',
			accent: '#8b5cf6',
			accentLight: '#ede9fe',
			accentDark: '#4c1d95',
			headerBg: '#8b5cf6',
			ringColor: '#8b5cf6',
			checkColor: '#8b5cf6',
			emoji: '🦄'
		},
		quote: { text: 'Be yourself; everyone else is already taken', author: 'Oscar Wilde' }
	},
	{
		name: 'Susana',
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
		quote: {
			text: 'You are braver than you believe, stronger than you seem, and smarter than you think',
			author: 'Winnie the Pooh'
		}
	},
	{
		name: 'Pedro',
		theme: {
			variant: 'playful',
			accent: '#3b82f6',
			accentLight: '#dbeafe',
			accentDark: '#1e3a5f',
			headerBg: '#3b82f6',
			ringColor: '#3b82f6',
			checkColor: '#3b82f6',
			emoji: '🚀'
		},
		quote: { text: 'To infinity and beyond!', author: 'Buzz Lightyear' }
	}
];

async function seedIfEmpty(): Promise<void> {
	const existing = db.select().from(familyMembers).all();
	if (existing.length > 0) return;

	const now = new Date().toISOString();
	for (const m of seedMembers) {
		db.insert(familyMembers)
			.values({
				id: createId(),
				name: m.name,
				themeVariant: m.theme.variant,
				themeAccent: m.theme.accent,
				themeAccentLight: m.theme.accentLight,
				themeAccentDark: m.theme.accentDark,
				themeHeaderBg: m.theme.headerBg,
				themeRingColor: m.theme.ringColor,
				themeCheckColor: m.theme.checkColor,
				themeEmoji: m.theme.emoji,
				quoteText: m.quote.text,
				quoteAuthor: m.quote.author,
				createdAt: now,
				updatedAt: now
			})
			.run();
	}
}

// ── GET /api/members ────────────────────────────────────

export const GET: RequestHandler = async () => {
	await seedIfEmpty();
	const rows = db.select().from(familyMembers).all();
	const members: Member[] = rows.map(rowToMember);
	return json(members);
};

// ── POST /api/members ───────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { name, theme, quote } = body as {
		name: string;
		theme: ThemeConfig;
		quote: { text: string; author: string };
	};

	if (!name?.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const now = new Date().toISOString();
	const id = createId();

	db.insert(familyMembers)
		.values({
			id,
			name: name.trim(),
			themeVariant: theme.variant,
			themeAccent: theme.accent,
			themeAccentLight: theme.accentLight,
			themeAccentDark: theme.accentDark,
			themeHeaderBg: theme.headerBg,
			themeRingColor: theme.ringColor,
			themeCheckColor: theme.checkColor,
			themeEmoji: theme.emoji,
			quoteText: quote.text,
			quoteAuthor: quote.author,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const member: Member = {
		id,
		name: name.trim(),
		theme,
		quote,
		createdAt: now,
		updatedAt: now
	};

	return json(member, { status: 201 });
};
