import { json } from '@sveltejs/kit';
import { describe, it, expect } from 'vitest';
import { NotFoundError, ValidationError, ConflictError, DomainError } from '../domain/errors';
import { apiHandler } from './api-handler';

function fakeEvent(overrides: Record<string, unknown> = {}) {
	return { url: new URL('http://localhost/api/test'), ...overrides } as any;
}

describe('apiHandler', () => {
	it('returns the response from the wrapped handler', async () => {
		const handler = apiHandler(() => json({ ok: true }, { status: 200 }));
		const response = await handler(fakeEvent());

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
	});

	it('converts ValidationError to 400', async () => {
		const handler = apiHandler(() => {
			throw new ValidationError('Name is required');
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Name is required');
	});

	it('converts NotFoundError to 404', async () => {
		const handler = apiHandler(() => {
			throw new NotFoundError('Task', 'abc');
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('Task not found: abc');
	});

	it('converts ConflictError to 409', async () => {
		const handler = apiHandler(() => {
			throw new ConflictError('Already exists');
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error).toBe('Already exists');
	});

	it('converts SyntaxError to 400 (malformed JSON)', async () => {
		const handler = apiHandler(() => {
			throw new SyntaxError('Unexpected token');
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Invalid request body');
	});

	it('converts generic DomainError to 500', async () => {
		const handler = apiHandler(() => {
			throw new DomainError('unexpected domain issue');
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe('unexpected domain issue');
	});

	it('re-throws unknown errors', async () => {
		const handler = apiHandler(() => {
			throw new Error('database connection lost');
		});

		await expect(handler(fakeEvent())).rejects.toThrow('database connection lost');
	});

	it('works with async handlers', async () => {
		const handler = apiHandler(async () => {
			await Promise.resolve();
			return json({ async: true });
		});
		const response = await handler(fakeEvent());

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.async).toBe(true);
	});
});
