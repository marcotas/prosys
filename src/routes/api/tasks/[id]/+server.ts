import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateTask } from '$lib/server/use-cases/tasks/update-task';
import { deleteTask } from '$lib/server/use-cases/tasks/delete-task';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { broadcast } from '$lib/server/ws';

// ── PATCH /api/tasks/[id] ──────────────────────────────

export const PATCH: RequestHandler = apiHandler(async ({ params, request, locals }) => {
	const input = await request.json();
	const { task, isMoved, fromDay, fromWeek } = updateTask.execute(params.id, input);

	if (isMoved) {
		broadcast(
			{ type: 'task:moved', payload: { task, fromDay, fromWeek } },
			locals.wsClientId
		);
	} else {
		broadcast({ type: 'task:updated', payload: task }, locals.wsClientId);
	}

	return json(task);
});

// ── DELETE /api/tasks/[id] ─────────────────────────────

export const DELETE: RequestHandler = apiHandler(async ({ params, locals }) => {
	const result = deleteTask.execute(params.id);

	broadcast(
		{ type: 'task:deleted', payload: result },
		locals.wsClientId
	);

	return json({ success: true });
});
