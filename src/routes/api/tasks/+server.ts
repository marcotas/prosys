import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createTask } from '$lib/server/use-cases/tasks/create-task';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// ── POST /api/tasks ────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const input = await request.json();
		const task = createTask.execute(input);
		broadcast({ type: 'task:created', payload: task }, locals.wsClientId);
		return json(task, { status: 201 });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
