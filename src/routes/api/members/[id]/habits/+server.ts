import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { habits, habitCompletions } from '$lib/server/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import type { HabitWithDays } from '$lib/types';

// ── Helpers ─────────────────────────────────────────────

function rowToHabit(row: typeof habits.$inferSelect) {
	return {
		id: row.id,
		memberId: row.memberId,
		name: row.name,
		emoji: row.emoji ?? undefined,
		sortOrder: row.sortOrder
	};
}

// ── GET /api/members/[id]/habits?week=YYYY-MM-DD ────────

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const weekStart = url.searchParams.get('week');

	if (!weekStart) {
		return json({ error: 'Missing "week" query parameter (YYYY-MM-DD)' }, { status: 400 });
	}

	// 1. Get all habit definitions for this member
	const habitRows = db
		.select()
		.from(habits)
		.where(eq(habits.memberId, id))
		.orderBy(asc(habits.sortOrder))
		.all();

	if (habitRows.length === 0) {
		return json([]);
	}

	// 2. Get completions for these habits in the given week
	const habitIds = habitRows.map((h) => h.id);
	const completionRows = db
		.select()
		.from(habitCompletions)
		.where(and(inArray(habitCompletions.habitId, habitIds), eq(habitCompletions.weekStart, weekStart)))
		.all();

	// 3. Build a lookup: habitId → Set<dayIndex>
	const completionMap = new Map<string, Set<number>>();
	for (const c of completionRows) {
		if (!completionMap.has(c.habitId)) {
			completionMap.set(c.habitId, new Set());
		}
		completionMap.get(c.habitId)!.add(c.dayIndex);
	}

	// 4. Merge into HabitWithDays[]
	const result: HabitWithDays[] = habitRows.map((row) => {
		const completedDays = completionMap.get(row.id) ?? new Set<number>();
		const days = Array.from({ length: 7 }, (_, i) => completedDays.has(i));
		return {
			...rowToHabit(row),
			days
		};
	});

	return json(result);
};
