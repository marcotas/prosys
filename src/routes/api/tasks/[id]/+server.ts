import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Task } from '$lib/types';
import { broadcast } from '$lib/server/ws';

// ── Helpers ─────────────────────────────────────────────

function rowToTask(row: typeof tasks.$inferSelect): Task {
	return {
		id: row.id,
		memberId: row.memberId ?? null,
		weekStart: row.weekStart,
		dayIndex: row.dayIndex,
		title: row.title,
		emoji: row.emoji ?? undefined,
		completed: row.completed,
		sortOrder: row.sortOrder
	};
}

// ── PATCH /api/tasks/[id] ──────────────────────────────

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;
	const body = await request.json();
	const { title, emoji, completed, dayIndex, sortOrder, memberId, weekStart } = body as {
		title?: string;
		emoji?: string;
		completed?: boolean;
		dayIndex?: number;
		sortOrder?: number;
		memberId?: string | null;
		weekStart?: string;
	};

	// Check task exists
	const existing = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!existing) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	// Build update object with only provided fields
	const updates: Record<string, string | number | boolean | null> = {
		updatedAt: new Date().toISOString()
	};

	if (title !== undefined) updates.title = title.trim();
	if (emoji !== undefined) updates.emoji = emoji || null;
	if (completed !== undefined) updates.completed = completed;
	if (dayIndex !== undefined) updates.dayIndex = dayIndex;
	if (sortOrder !== undefined) updates.sortOrder = sortOrder;
	if (memberId !== undefined) updates.memberId = memberId || null;
	if (weekStart !== undefined) updates.weekStart = weekStart;

	db.update(tasks).set(updates).where(eq(tasks.id, id)).run();

	// Return the full updated task
	const updated = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!updated) {
		return json({ error: 'Task not found after update' }, { status: 500 });
	}

	const task = rowToTask(updated);

	// If dayIndex or weekStart changed, this is a move — broadcast the more specific message
	const isMove = (dayIndex !== undefined && dayIndex !== existing.dayIndex)
		|| (weekStart !== undefined && weekStart !== existing.weekStart);
	if (isMove) {
		broadcast({ type: 'task:moved', payload: { task, fromDay: existing.dayIndex, fromWeek: existing.weekStart } }, locals.wsClientId);
	} else {
		broadcast({ type: 'task:updated', payload: task }, locals.wsClientId);
	}

	return json(task);
};

// ── DELETE /api/tasks/[id] ─────────────────────────────

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	const existing = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!existing) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	db.delete(tasks).where(eq(tasks.id, id)).run();

	broadcast(
		{
			type: 'task:deleted',
			payload: {
				id,
				memberId: existing.memberId ?? null,
				weekStart: existing.weekStart,
				dayIndex: existing.dayIndex
			}
		},
		locals.wsClientId
	);

	return json({ success: true });
};
