import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { familyMembers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

// ── PATCH /api/members/[id] ─────────────────────────────

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { id } = params;
	const body = await request.json();
	const { name, theme, quote } = body as {
		name?: string;
		theme?: ThemeConfig;
		quote?: { text: string; author: string };
	};

	// Check member exists
	const existing = db.select().from(familyMembers).where(eq(familyMembers.id, id)).get();
	if (!existing) {
		return json({ error: 'Member not found' }, { status: 404 });
	}

	// Build update object with only provided fields
	const updates: Record<string, string> = {
		updatedAt: new Date().toISOString()
	};

	if (name !== undefined) {
		updates.name = name.trim();
	}

	if (theme !== undefined) {
		updates.themeVariant = theme.variant;
		updates.themeAccent = theme.accent;
		updates.themeAccentLight = theme.accentLight;
		updates.themeAccentDark = theme.accentDark;
		updates.themeHeaderBg = theme.headerBg;
		updates.themeRingColor = theme.ringColor;
		updates.themeCheckColor = theme.checkColor;
		updates.themeEmoji = theme.emoji;
	}

	if (quote !== undefined) {
		updates.quoteText = quote.text;
		updates.quoteAuthor = quote.author;
	}

	db.update(familyMembers).set(updates).where(eq(familyMembers.id, id)).run();

	// Return the full updated member
	const updated = db.select().from(familyMembers).where(eq(familyMembers.id, id)).get();
	if (!updated) {
		return json({ error: 'Member not found after update' }, { status: 500 });
	}

	return json(rowToMember(updated));
};

// ── DELETE /api/members/[id] ────────────────────────────

export const DELETE: RequestHandler = async ({ params }) => {
	const { id } = params;

	const existing = db.select().from(familyMembers).where(eq(familyMembers.id, id)).get();
	if (!existing) {
		return json({ error: 'Member not found' }, { status: 404 });
	}

	// FK cascade in schema handles deleting related tasks and habits
	db.delete(familyMembers).where(eq(familyMembers.id, id)).run();

	return json({ success: true });
};
