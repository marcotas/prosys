import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderHabits } from '$lib/server/use-cases/habits/reorder-habits';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// -- PUT /api/habits/reorder -----------------------------------------

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		const { memberId, habitIds } = await request.json() as {
			memberId: string;
			habitIds: string[];
		};

		reorderHabits.execute({ memberId, habitIds });

		broadcast(
			{ type: 'habit:reordered', payload: { memberId, habitIds } },
			locals.wsClientId
		);

		return json({ ok: true });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
