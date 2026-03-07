import { json } from '@sveltejs/kit';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { createHabit } from '$lib/server/use-cases/habits/create-habit';
import { broadcast } from '$lib/server/ws';

// -- POST /api/habits ------------------------------------------------

export const POST = apiHandler(async ({ request, locals }) => {
	const input = await request.json();
	const habit = createHabit.execute(input);

	broadcast({ type: 'habit:created', payload: habit }, locals.wsClientId);

	return json(habit, { status: 201 });
});
