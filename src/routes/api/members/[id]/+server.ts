import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateMember } from '$lib/server/use-cases/members/update-member';
import { deleteMember } from '$lib/server/use-cases/members/delete-member';
import { handleDomainError } from '$lib/server/helpers/handle-domain-error';
import { broadcast } from '$lib/server/ws';

// ── PATCH /api/members/[id] ─────────────────────────────

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const input = await request.json();
		const member = updateMember.execute(params.id, input);
		broadcast({ type: 'member:updated', payload: member }, locals.wsClientId);
		return json(member);
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};

// ── DELETE /api/members/[id] ────────────────────────────

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		deleteMember.execute(params.id);
		broadcast({ type: 'member:deleted', payload: { id: params.id } }, locals.wsClientId);
		return json({ success: true });
	} catch (err) {
		return handleDomainError(err) ?? (() => { throw err; })();
	}
};
