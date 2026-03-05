import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMemberHabits } from '$lib/server/use-cases/habits/get-member-habits';
import { apiHandler } from '$lib/server/helpers/api-handler';

// -- GET /api/members/[id]/habits?week=YYYY-MM-DD --------------------

export const GET: RequestHandler = apiHandler(async ({ params, url }) => {
	const weekStart = url.searchParams.get('week') ?? '';
	const result = getMemberHabits.execute(params.id, weekStart);
	return json(result);
});
