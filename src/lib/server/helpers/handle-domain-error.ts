import { json } from '@sveltejs/kit';
import { NotFoundError, ValidationError } from '../domain/errors';

export function handleDomainError(err: unknown): Response | null {
	if (err instanceof NotFoundError) return json({ error: err.message }, { status: 404 });
	if (err instanceof ValidationError) return json({ error: err.message }, { status: 400 });
	return null;
}
