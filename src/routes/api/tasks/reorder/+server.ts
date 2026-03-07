import { json } from '@sveltejs/kit';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { reorderTasks } from '$lib/server/use-cases/tasks/reorder-tasks';
import { broadcast } from '$lib/server/ws';

export const PUT = apiHandler(async ({ request, locals }) => {
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
});
