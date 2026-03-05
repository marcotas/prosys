import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFamilyHabits } from '$lib/server/use-cases/habits/get-family-habits';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';

// -- GET /api/family/habits?week=YYYY-MM-DD --------------------------

export const GET: RequestHandler = async ({ url }) => {
	try {
		const weekStart = url.searchParams.get('week') ?? '';
		const result = getFamilyHabits.execute(weekStart);

		return json(result);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
