import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { habits, habitCompletions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '$lib/utils/ids';
import { broadcast } from '$lib/server/ws';

// ── PUT /api/habits/[id]/toggle ─────────────────────────

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;
	const body = await request.json();
	const { weekStart, dayIndex } = body as {
		weekStart: string;
		dayIndex: number;
	};

	if (!weekStart?.trim()) {
		return json({ error: 'weekStart is required' }, { status: 400 });
	}
	if (dayIndex === undefined || dayIndex < 0 || dayIndex > 6) {
		return json({ error: 'dayIndex must be 0-6' }, { status: 400 });
	}

	// Verify habit exists
	const habit = db.select().from(habits).where(eq(habits.id, id)).get();
	if (!habit) {
		return json({ error: 'Habit not found' }, { status: 404 });
	}

	// Check if completion row exists
	const existing = db
		.select()
		.from(habitCompletions)
		.where(
			and(
				eq(habitCompletions.habitId, id),
				eq(habitCompletions.weekStart, weekStart),
				eq(habitCompletions.dayIndex, dayIndex)
			)
		)
		.get();

	let completed: boolean;

	if (existing) {
		// Delete — uncomplete
		db.delete(habitCompletions).where(eq(habitCompletions.id, existing.id)).run();
		completed = false;
	} else {
		// Insert — complete
		db.insert(habitCompletions)
			.values({
				id: createId(),
				habitId: id,
				weekStart,
				dayIndex,
				completed: true
			})
			.run();
		completed = true;
	}

	broadcast(
		{ type: 'habit:toggled', payload: { habitId: id, weekStart, dayIndex, completed } },
		locals.wsClientId
	);

	return json({ completed });
};
