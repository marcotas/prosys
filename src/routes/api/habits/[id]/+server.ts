import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { habits } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Habit } from '$lib/types';
import { broadcast } from '$lib/server/ws';

// ── Helpers ─────────────────────────────────────────────

function rowToHabit(row: typeof habits.$inferSelect): Habit {
	return {
		id: row.id,
		memberId: row.memberId,
		name: row.name,
		emoji: row.emoji ?? undefined,
		sortOrder: row.sortOrder
	};
}

// ── PATCH /api/habits/[id] ──────────────────────────────

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;
	const body = await request.json();
	const { name, emoji } = body as {
		name?: string;
		emoji?: string;
	};

	// Check habit exists
	const existing = db.select().from(habits).where(eq(habits.id, id)).get();
	if (!existing) {
		return json({ error: 'Habit not found' }, { status: 404 });
	}

	// Build update object with only provided fields
	const updates: Record<string, string | null> = {
		updatedAt: new Date().toISOString()
	};

	if (name !== undefined) updates.name = name.trim();
	if (emoji !== undefined) updates.emoji = emoji || null;

	db.update(habits).set(updates).where(eq(habits.id, id)).run();

	// Return the full updated habit
	const updated = db.select().from(habits).where(eq(habits.id, id)).get();
	if (!updated) {
		return json({ error: 'Habit not found after update' }, { status: 500 });
	}

	const habit = rowToHabit(updated);
	broadcast({ type: 'habit:updated', payload: habit }, locals.wsClientId);

	return json(habit);
};

// ── DELETE /api/habits/[id] ─────────────────────────────

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	const existing = db.select().from(habits).where(eq(habits.id, id)).get();
	if (!existing) {
		return json({ error: 'Habit not found' }, { status: 404 });
	}

	// Cascades to habit_completions via FK
	db.delete(habits).where(eq(habits.id, id)).run();

	broadcast(
		{ type: 'habit:deleted', payload: { id, memberId: existing.memberId } },
		locals.wsClientId
	);

	return json({ success: true });
};
