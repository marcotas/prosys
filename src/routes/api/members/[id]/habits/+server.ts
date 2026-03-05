import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMemberHabits } from '$lib/server/use-cases/habits/get-member-habits';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';

// -- GET /api/members/[id]/habits?week=YYYY-MM-DD --------------------

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const weekStart = url.searchParams.get('week') ?? '';
		const result = getMemberHabits.execute(params.id, weekStart);

		return json(result);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
