import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, sqlite } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { broadcast } from '$lib/server/ws';

// ── PUT /api/tasks/reorder ──────────────────────────────
// Batch-reorder tasks within a specific day.
// Body: { memberId, weekStart, dayIndex, taskIds: string[] }

export const PUT: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const { memberId, weekStart, dayIndex, taskIds } = body as {
		memberId: string;
		weekStart: string;
		dayIndex: number;
		taskIds: string[];
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
	if (!Array.isArray(taskIds) || taskIds.length === 0) {
		return json({ error: 'taskIds must be a non-empty array' }, { status: 400 });
	}

	// Verify all tasks belong to this member/week/day
	const existing = db
		.select({ id: tasks.id })
		.from(tasks)
		.where(
			and(
				eq(tasks.memberId, memberId),
				eq(tasks.weekStart, weekStart),
				eq(tasks.dayIndex, dayIndex)
			)
		)
		.all();

	const existingIds = new Set(existing.map((t) => t.id));
	for (const id of taskIds) {
		if (!existingIds.has(id)) {
			return json({ error: `Task ${id} not found in this day` }, { status: 400 });
		}
	}

	// Update sort_order in a transaction
	const now = new Date().toISOString();
	const stmt = sqlite.prepare(
		'UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?'
	);

	const transaction = sqlite.transaction(() => {
		for (let i = 0; i < taskIds.length; i++) {
			stmt.run(i, now, taskIds[i]);
		}
	});
	transaction();

	broadcast(
		{ type: 'task:reordered', payload: { memberId, weekStart, dayIndex, taskIds } },
		locals.wsClientId
	);

	return json({ ok: true });
};
