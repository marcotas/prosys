import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleHabit } from '$lib/server/use-cases/habits/toggle-habit';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// -- PUT /api/habits/[id]/toggle -------------------------------------

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { weekStart, dayIndex } = await request.json() as {
			weekStart: string;
			dayIndex: number;
		};

		const result = toggleHabit.execute(params.id, weekStart, dayIndex);

		broadcast(
			{
				type: 'habit:toggled',
				payload: { habitId: params.id, weekStart, dayIndex, completed: result.completed }
			},
			locals.wsClientId
		);

		return json(result);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
