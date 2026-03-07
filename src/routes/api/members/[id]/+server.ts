import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { deleteMember } from '$lib/server/use-cases/members/delete-member';
import { updateMember } from '$lib/server/use-cases/members/update-member';
import { broadcast } from '$lib/server/ws';

// ── PATCH /api/members/[id] ─────────────────────────────

export const PATCH: RequestHandler = apiHandler(async ({ params, request, locals }) => {
	const input = await request.json();
	const member = updateMember.execute(params.id, input);
	broadcast({ type: 'member:updated', payload: member }, locals.wsClientId);
	return json(member);
});

// ── DELETE /api/members/[id] ────────────────────────────

export const DELETE: RequestHandler = apiHandler(async ({ params, locals }) => {
	deleteMember.execute(params.id);
	broadcast({ type: 'member:deleted', payload: { id: params.id } }, locals.wsClientId);
	return json({ success: true });
});
