import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateHabit } from '$lib/server/use-cases/habits/update-habit';
import { deleteHabit } from '$lib/server/use-cases/habits/delete-habit';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// -- PATCH /api/habits/[id] ------------------------------------------

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { name, emoji } = await request.json() as { name?: string; emoji?: string };
		const habit = updateHabit.execute(params.id, { name, emoji });

		broadcast({ type: 'habit:updated', payload: habit }, locals.wsClientId);

		return json(habit);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};

// -- DELETE /api/habits/[id] -----------------------------------------

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const result = deleteHabit.execute(params.id);

		broadcast(
			{ type: 'habit:deleted', payload: result },
			locals.wsClientId
		);

		return json({ success: true });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
