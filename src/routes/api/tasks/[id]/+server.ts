import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateTask } from '$lib/server/use-cases/tasks/update-task';
import { deleteTask } from '$lib/server/use-cases/tasks/delete-task';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// ── PATCH /api/tasks/[id] ──────────────────────────────

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
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
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};

// ── DELETE /api/tasks/[id] ─────────────────────────────

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const result = deleteTask.execute(params.id);

		broadcast(
			{ type: 'task:deleted', payload: result },
			locals.wsClientId
		);

		return json({ success: true });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
