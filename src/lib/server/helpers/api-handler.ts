import type { RequestEvent } from '@sveltejs/kit';
import { handleDomainError } from './handle-domain-error';

type RouteHandler<P extends Partial<Record<string, string>> = Partial<Record<string, string>>> =
	(event: RequestEvent<P>) => Promise<Response> | Response;

export function apiHandler<P extends Partial<Record<string, string>>>(
	fn: RouteHandler<P>
): RouteHandler<P> {
	return async (event) => {
		try {
			return await fn(event);
		} catch (err) {
			const response = handleDomainError(err);
			if (response) return response;
			throw err;
		}
	};
}
