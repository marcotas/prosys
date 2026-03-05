import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMemberTasks } from '$lib/server/use-cases/tasks/get-member-tasks';
import { apiHandler } from '$lib/server/helpers/api-handler';

// ── GET /api/members/[id]/tasks?week=YYYY-MM-DD ────────

export const GET: RequestHandler = apiHandler(async ({ params, url }) => {
	const weekStart = url.searchParams.get('week') ?? '';
	const tasks = getMemberTasks.execute(params.id, weekStart);
	return json(tasks);
});
