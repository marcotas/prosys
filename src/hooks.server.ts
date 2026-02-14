import type { Handle } from '@sveltejs/kit';

/**
 * Extract the WS client ID from incoming requests so API routes
 * can pass it to broadcast() for sender-exclusion.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const clientId = event.request.headers.get('x-ws-client-id');
	if (clientId) {
		event.locals.wsClientId = clientId;
	}
	return resolve(event);
};
