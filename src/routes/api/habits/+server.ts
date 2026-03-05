import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHabit } from '$lib/server/use-cases/habits/create-habit';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// -- POST /api/habits ------------------------------------------------

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const input = await request.json();
		const habit = createHabit.execute(input);

		broadcast({ type: 'habit:created', payload: habit }, locals.wsClientId);

		return json(habit, { status: 201 });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
