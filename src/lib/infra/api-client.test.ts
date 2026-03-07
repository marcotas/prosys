import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from './api-client';
import { ApiError } from '$lib/utils/api-error';

describe('ApiClient', () => {
	let client: ApiClient;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		client = new ApiClient();
		client.setClientId('test-client-id');
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockFetch(response: { ok: boolean; status?: number; json?: unknown }) {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: response.ok,
			status: response.status ?? 200,
			json: vi.fn().mockResolvedValue(response.json ?? {}),
			text: vi.fn().mockResolvedValue(JSON.stringify(response.json ?? {}))
		});
	}

	function mockFetchError(response: { status: number; error: string }) {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: response.status,
			json: vi.fn().mockResolvedValue({ error: response.error })
		});
	}

	it('get() sends GET request with headers', async () => {
		mockFetch({ ok: true, json: { id: '1' } });

		const result = await client.get('/api/tasks');

		expect(result).toEqual({ id: '1' });
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			}
		});
	});

	it('post() sends POST request with body', async () => {
		mockFetch({ ok: true, json: { id: '1', title: 'New' } });

		const result = await client.post('/api/tasks', { title: 'New' });

		expect(result).toEqual({ id: '1', title: 'New' });
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			},
			body: JSON.stringify({ title: 'New' })
		});
	});

	it('patch() sends PATCH request with body', async () => {
		mockFetch({ ok: true, json: { id: '1', title: 'Updated' } });

		const result = await client.patch('/api/tasks/1', { title: 'Updated' });

		expect(result).toEqual({ id: '1', title: 'Updated' });
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			},
			body: JSON.stringify({ title: 'Updated' })
		});
	});

	it('put() sends PUT request with body', async () => {
		mockFetch({ ok: true, json: {} });

		await client.put('/api/tasks/reorder', { taskIds: ['1', '2'] });

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/reorder', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			},
			body: JSON.stringify({ taskIds: ['1', '2'] })
		});
	});

	it('delete() sends DELETE request without body', async () => {
		mockFetch({ ok: true, json: {} });

		await client.delete('/api/tasks/1');

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			}
		});
	});

	it('omits X-WS-Client-Id header when clientId is empty', async () => {
		client = new ApiClient(); // no setClientId
		mockFetch({ ok: true, json: {} });

		await client.get('/api/tasks');

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
	});

	it('throws ApiError on non-ok response', async () => {
		mockFetchError({ status: 404, error: 'Task not found' });

		await expect(client.get('/api/tasks/999')).rejects.toThrow(ApiError);
		await expect(client.get('/api/tasks/999')).rejects.toThrow('Task not found');
	});

	it('throws ApiError with fallback message on non-JSON error response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
		});

		await expect(client.get('/api/tasks')).rejects.toThrow('Request failed (500)');
	});

	it('getHeaders() returns X-WS-Client-Id when clientId is set', () => {
		expect(client.getHeaders()).toEqual({ 'X-WS-Client-Id': 'test-client-id' });
	});

	it('getHeaders() returns empty object when clientId is not set', () => {
		const noIdClient = new ApiClient();
		expect(noIdClient.getHeaders()).toEqual({});
	});

	it('post() without body omits body from request', async () => {
		mockFetch({ ok: true, json: {} });

		await client.post('/api/trigger');

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/trigger', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WS-Client-Id': 'test-client-id'
			}
		});
	});
});
