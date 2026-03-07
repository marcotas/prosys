import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiHandler } from '$lib/server/helpers/api-handler';
import { createMember } from '$lib/server/use-cases/members/create-member';
import { getMembers } from '$lib/server/use-cases/members/get-members';
import { broadcast } from '$lib/server/ws';

// ── GET /api/members ────────────────────────────────────

export const GET: RequestHandler = async () => {
	const members = getMembers.execute();
	return json(members);
};

// ── POST /api/members ───────────────────────────────────

export const POST = apiHandler(async ({ request, locals }) => {
	const input = await request.json();
	const member = createMember.execute(input);
	broadcast({ type: 'member:created', payload: member }, locals.wsClientId);
	return json(member, { status: 201 });
});
