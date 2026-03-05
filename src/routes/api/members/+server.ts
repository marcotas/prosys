import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMembers } from '$lib/server/use-cases/members/get-members';
import { createMember } from '$lib/server/use-cases/members/create-member';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// ── GET /api/members ────────────────────────────────────

export const GET: RequestHandler = async () => {
	const members = getMembers.execute();
	return json(members);
};

// ── POST /api/members ───────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const input = await request.json();
		const member = createMember.execute(input);
		broadcast({ type: 'member:created', payload: member }, locals.wsClientId);
		return json(member, { status: 201 });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
