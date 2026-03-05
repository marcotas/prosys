import { json } from '@sveltejs/kit';
import { getFamilyHabits } from '$lib/server/use-cases/habits/get-family-habits';
import { apiHandler } from '$lib/server/helpers/api-handler';

// -- GET /api/family/habits?week=YYYY-MM-DD --------------------------

export const GET = apiHandler(async ({ url }) => {
	const weekStart = url.searchParams.get('week') ?? '';
	const result = getFamilyHabits.execute(weekStart);
	return json(result);
});
