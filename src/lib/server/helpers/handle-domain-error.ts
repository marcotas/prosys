import { json } from '@sveltejs/kit';
import { ConflictError, DomainError, NotFoundError, ValidationError } from '../domain/errors';

export function handleDomainError(err: unknown): Response | null {
	if (err instanceof ValidationError) return json({ error: err.message }, { status: 400 });
	if (err instanceof NotFoundError) return json({ error: err.message }, { status: 404 });
	if (err instanceof ConflictError) return json({ error: err.message }, { status: 409 });
	if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
	if (err instanceof DomainError) return json({ error: err.message }, { status: 500 });
	return null;
}
