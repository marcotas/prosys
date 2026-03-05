import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFamilyTasks } from '$lib/server/use-cases/tasks/get-family-tasks';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const weekStart = url.searchParams.get('week') ?? '';
		const tasks = getFamilyTasks.execute(weekStart);
		return json(tasks);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
