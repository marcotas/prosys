import { json } from '@sveltejs/kit';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { createTask } from '$lib/server/use-cases/tasks/create-task';
import { broadcast } from '$lib/server/ws';

// ── POST /api/tasks ────────────────────────────────────

export const POST = apiHandler(async ({ request, locals }) => {
	const input = await request.json();
	const task = createTask.execute(input);
	broadcast({ type: 'task:created', payload: task }, locals.wsClientId);
	return json(task, { status: 201 });
});
