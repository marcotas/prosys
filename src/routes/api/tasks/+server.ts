import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import { eq, and, max } from 'drizzle-orm';
import { createId } from '$lib/utils/ids';
import type { Task } from '$lib/types';

// ── Helpers ─────────────────────────────────────────────

function rowToTask(row: typeof tasks.$inferSelect): Task {
	return {
		id: row.id,
		memberId: row.memberId,
		weekStart: row.weekStart,
		dayIndex: row.dayIndex,
		title: row.title,
		emoji: row.emoji ?? undefined,
		completed: row.completed,
		sortOrder: row.sortOrder
	};
}

// ── POST /api/tasks ────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { memberId, weekStart, dayIndex, title, emoji } = body as {
		memberId: string;
		weekStart: string;
		dayIndex: number;
		title: string;
		emoji?: string;
	};

	if (!memberId?.trim()) {
		return json({ error: 'memberId is required' }, { status: 400 });
	}
	if (!weekStart?.trim()) {
		return json({ error: 'weekStart is required' }, { status: 400 });
	}
	if (dayIndex === undefined || dayIndex < 0 || dayIndex > 6) {
		return json({ error: 'dayIndex must be 0-6' }, { status: 400 });
	}
	if (!title?.trim()) {
		return json({ error: 'title is required' }, { status: 400 });
	}

	// Compute next sortOrder for this day
	const maxResult = db
		.select({ maxSort: max(tasks.sortOrder) })
		.from(tasks)
		.where(
			and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart), eq(tasks.dayIndex, dayIndex))
		)
		.get();
	const nextSort = (maxResult?.maxSort ?? -1) + 1;

	const now = new Date().toISOString();
	const id = createId();

	db.insert(tasks)
		.values({
			id,
			memberId,
			weekStart,
			dayIndex,
			title: title.trim(),
			emoji: emoji || null,
			completed: false,
			sortOrder: nextSort,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const task: Task = {
		id,
		memberId,
		weekStart,
		dayIndex,
		title: title.trim(),
		emoji: emoji || undefined,
		completed: false,
		sortOrder: nextSort
	};

	return json(task, { status: 201 });
};
