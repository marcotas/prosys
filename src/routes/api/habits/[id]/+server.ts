import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { deleteHabit } from '$lib/server/use-cases/habits/delete-habit';
import { updateHabit } from '$lib/server/use-cases/habits/update-habit';
import { broadcast } from '$lib/server/ws';

// -- PATCH /api/habits/[id] ------------------------------------------

export const PATCH: RequestHandler = apiHandler(async ({ params, request, locals }) => {
	const { name, emoji } = await request.json() as { name?: string; emoji?: string };
	const habit = updateHabit.execute(params.id, { name, emoji });

	broadcast({ type: 'habit:updated', payload: habit }, locals.wsClientId);

	return json(habit);
});

// -- DELETE /api/habits/[id] -----------------------------------------

export const DELETE: RequestHandler = apiHandler(async ({ params, locals }) => {
	const result = deleteHabit.execute(params.id);

	broadcast(
		{ type: 'habit:deleted', payload: result },
		locals.wsClientId
	);

	return json({ success: true });
});
