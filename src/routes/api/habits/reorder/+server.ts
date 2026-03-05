import { json } from '@sveltejs/kit';
import { reorderHabits } from '$lib/server/use-cases/habits/reorder-habits';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { broadcast } from '$lib/server/ws';

// -- PUT /api/habits/reorder -----------------------------------------

export const PUT = apiHandler(async ({ request, locals }) => {
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
});
