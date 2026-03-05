import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMemberTasks } from '$lib/server/use-cases/tasks/get-member-tasks';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';

// ── GET /api/members/[id]/tasks?week=YYYY-MM-DD ────────

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const weekStart = url.searchParams.get('week') ?? '';
		const tasks = getMemberTasks.execute(params.id, weekStart);
		return json(tasks);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
