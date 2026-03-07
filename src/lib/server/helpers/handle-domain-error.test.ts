import { describe, it, expect } from 'vitest';
import { ConflictError, NotFoundError, ValidationError, DomainError } from '../domain/errors';
import { handleDomainError } from './handle-domain-error';

// ── handleDomainError ────────────────────────────────────

describe('handleDomainError', () => {
	it('returns 400 response for ValidationError', async () => {
		const err = new ValidationError('Name is required');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(400);

		const body = await response!.json();
		expect(body.error).toBe('Name is required');
	});

	it('returns 404 response for NotFoundError', async () => {
		const err = new NotFoundError('Task', 'abc-123');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(404);

		const body = await response!.json();
		expect(body.error).toBe('Task not found: abc-123');
	});

	it('returns 409 response for ConflictError', async () => {
		const err = new ConflictError('Habit completion already exists');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(409);

		const body = await response!.json();
		expect(body.error).toBe('Habit completion already exists');
	});

	it('returns 400 response for SyntaxError (malformed JSON)', async () => {
		const err = new SyntaxError('Unexpected token } in JSON');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(400);

		const body = await response!.json();
		expect(body.error).toBe('Invalid request body');
	});

	it('returns 500 response for generic DomainError', async () => {
		const err = new DomainError('some domain error');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(500);

		const body = await response!.json();
		expect(body.error).toBe('some domain error');
	});

	it('returns null for standard Error', () => {
		const err = new Error('unexpected');
		const response = handleDomainError(err);
		expect(response).toBeNull();
	});

	it('returns null for non-Error values', () => {
		expect(handleDomainError('string error')).toBeNull();
		expect(handleDomainError(42)).toBeNull();
		expect(handleDomainError(null)).toBeNull();
		expect(handleDomainError(undefined)).toBeNull();
	});
});
