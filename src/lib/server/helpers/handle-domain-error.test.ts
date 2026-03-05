import { describe, it, expect } from 'vitest';
import { handleDomainError } from './handle-domain-error';
import { NotFoundError, ValidationError, DomainError } from '../domain/errors';

// ── handleDomainError ────────────────────────────────────

describe('handleDomainError', () => {
	it('returns 404 response for NotFoundError', async () => {
		const err = new NotFoundError('Task', 'abc-123');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(404);

		const body = await response!.json();
		expect(body.error).toBe('Task not found: abc-123');
	});

	it('returns 400 response for ValidationError', async () => {
		const err = new ValidationError('Name is required');
		const response = handleDomainError(err);

		expect(response).not.toBeNull();
		expect(response!.status).toBe(400);

		const body = await response!.json();
		expect(body.error).toBe('Name is required');
	});

	it('returns null for generic DomainError', () => {
		const err = new DomainError('some domain error');
		const response = handleDomainError(err);
		expect(response).toBeNull();
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
