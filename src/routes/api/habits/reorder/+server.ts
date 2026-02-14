import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, sqlite } from '$lib/server/db';
import { habits } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// ── PUT /api/habits/reorder ─────────────────────────────
// Batch-reorder habits for a member.
// Body: { memberId, habitIds: string[] }

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { memberId, habitIds } = body as {
		memberId: string;
		habitIds: string[];
	};

	if (!memberId?.trim()) {
		return json({ error: 'memberId is required' }, { status: 400 });
	}
	if (!Array.isArray(habitIds) || habitIds.length === 0) {
		return json({ error: 'habitIds must be a non-empty array' }, { status: 400 });
	}

	// Verify all habits belong to this member
	const existing = db
		.select({ id: habits.id })
		.from(habits)
		.where(eq(habits.memberId, memberId))
		.all();

	const existingIds = new Set(existing.map((h) => h.id));
	for (const id of habitIds) {
		if (!existingIds.has(id)) {
			return json({ error: `Habit ${id} not found for this member` }, { status: 400 });
		}
	}

	// Update sort_order in a transaction
	const now = new Date().toISOString();
	const stmt = sqlite.prepare(
		'UPDATE habits SET sort_order = ?, updated_at = ? WHERE id = ?'
	);

	const transaction = sqlite.transaction(() => {
		for (let i = 0; i < habitIds.length; i++) {
			stmt.run(i, now, habitIds[i]);
		}
	});
	transaction();

	return json({ ok: true });
};
