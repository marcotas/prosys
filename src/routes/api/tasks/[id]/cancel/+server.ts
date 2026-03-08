import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { cancelTask } from '$lib/server/use-cases/tasks/cancel-task';
import { broadcast } from '$lib/server/ws';

// ── POST /api/tasks/[id]/cancel ──────────────────────────

export const POST: RequestHandler = apiHandler(async ({ params, locals }) => {
	const task = cancelTask.execute(params.id);

	broadcast(
		{ type: 'task:cancelled', payload: task },
		locals.wsClientId
	);

	return json(task);
});
