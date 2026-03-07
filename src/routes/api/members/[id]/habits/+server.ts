import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { getMemberHabits } from '$lib/server/use-cases/habits/get-member-habits';

// -- GET /api/members/[id]/habits?week=YYYY-MM-DD --------------------

export const GET: RequestHandler = apiHandler(async ({ params, url }) => {
	const weekStart = url.searchParams.get('week') ?? '';
	const result = getMemberHabits.execute(params.id, weekStart);
	return json(result);
});
