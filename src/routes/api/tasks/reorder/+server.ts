import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderTasks } from '$lib/server/use-cases/tasks/reorder-tasks';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { memberId, weekStart, dayIndex, taskIds } = body as {
			memberId?: string | null;
			weekStart: string;
			dayIndex: number;
			taskIds: string[];
		};

		reorderTasks.execute({ memberId, weekStart, dayIndex, taskIds });

		const resolvedMemberId =
			typeof memberId === 'string' ? memberId.trim() || null : null;

		broadcast(
			{ type: 'task:reordered', payload: { memberId: resolvedMemberId, weekStart, dayIndex, taskIds } },
			locals.wsClientId
		);

		return json({ ok: true });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
