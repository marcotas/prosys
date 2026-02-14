import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { habits } from '$lib/server/db/schema';
import { eq, max } from 'drizzle-orm';
import { createId } from '$lib/utils/ids';
import type { Habit } from '$lib/types';

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

// ── POST /api/habits ────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { memberId, name, emoji } = body as {
		memberId: string;
		name: string;
		emoji?: string;
	};

	if (!memberId?.trim()) {
		return json({ error: 'memberId is required' }, { status: 400 });
	}
	if (!name?.trim()) {
		return json({ error: 'name is required' }, { status: 400 });
	}

	// Compute next sortOrder for this member
	const maxResult = db
		.select({ maxSort: max(habits.sortOrder) })
		.from(habits)
		.where(eq(habits.memberId, memberId))
		.get();
	const nextSort = (maxResult?.maxSort ?? -1) + 1;

	const now = new Date().toISOString();
	const id = createId();

	db.insert(habits)
		.values({
			id,
			memberId,
			name: name.trim(),
			emoji: emoji || null,
			sortOrder: nextSort,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const habit: Habit = {
		id,
		memberId,
		name: name.trim(),
		emoji: emoji || undefined,
		sortOrder: nextSort
	};

	return json(habit, { status: 201 });
};
