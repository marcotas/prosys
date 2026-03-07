import { json } from '@sveltejs/kit';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { getFamilyTasks } from '$lib/server/use-cases/tasks/get-family-tasks';

export const GET = apiHandler(async ({ url }) => {
	const weekStart = url.searchParams.get('week') ?? '';
	const tasks = getFamilyTasks.execute(weekStart);
	return json(tasks);
});
