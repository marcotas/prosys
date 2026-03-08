import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { rescheduleTask } from '$lib/server/use-cases/tasks/reschedule-task';
import { broadcast } from '$lib/server/ws';

// ── POST /api/tasks/[id]/reschedule ────────────────────

export const POST: RequestHandler = apiHandler(async ({ params, request, locals }) => {
	const { toWeekStart, toDayIndex } = await request.json();
	const { original, newTask } = rescheduleTask.execute(params.id, toWeekStart, toDayIndex);

	broadcast(
		{ type: 'task:rescheduled', payload: { original, newTask } },
		locals.wsClientId
	);

	return json({ original, newTask }, { status: 201 });
});
