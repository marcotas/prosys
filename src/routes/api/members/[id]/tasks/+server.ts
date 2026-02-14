import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
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

// ── GET /api/members/[id]/tasks?week=YYYY-MM-DD ────────

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const weekStart = url.searchParams.get('week');

	if (!weekStart) {
		return json({ error: 'Missing "week" query parameter (YYYY-MM-DD)' }, { status: 400 });
	}

	const rows = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.memberId, id), eq(tasks.weekStart, weekStart)))
		.orderBy(asc(tasks.dayIndex), asc(tasks.sortOrder))
		.all();

	const result: Task[] = rows.map(rowToTask);
	return json(result);
};
