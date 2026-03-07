import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineQueue } from './offline-queue';

describe('OfflineQueue', () => {
	let queue: OfflineQueue;
	const originalFetch = globalThis.fetch;

	beforeEach(async () => {
		queue = new OfflineQueue();
		// Delete existing DB to start fresh
		await new Promise<void>((resolve) => {
			const req = indexedDB.deleteDatabase('prosys-offline');
			req.onsuccess = () => resolve();
			req.onerror = () => resolve();
		});
		queue = new OfflineQueue();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		queue.dispose();
	});

	it('starts with pendingCount 0', () => {
		expect(queue.pendingCount).toBe(0);
	});

	it('init() loads pending count from IndexedDB', async () => {
		// Enqueue some items first
		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		await queue.enqueue({ method: 'DELETE', url: '/api/tasks/1' });

		// Create a fresh queue and init it
		const fresh = new OfflineQueue();
		expect(fresh.pendingCount).toBe(0);
		await fresh.init();
		expect(fresh.pendingCount).toBe(2);
		fresh.dispose();
	});

	it('enqueue() adds a mutation and increments pendingCount', async () => {
		await queue.enqueue({ method: 'POST', url: '/api/tasks', body: { title: 'Test' } });
		expect(queue.pendingCount).toBe(1);

		await queue.enqueue({ method: 'DELETE', url: '/api/tasks/1' });
		expect(queue.pendingCount).toBe(2);
	});

	it('enqueue() notifies listeners', async () => {
		const listener = vi.fn();
		queue.onChange(listener);

		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		expect(listener).toHaveBeenCalledOnce();
	});

	it('getAll() returns mutations sorted by timestamp (FIFO)', async () => {
		// Use explicit timestamps via vi.spyOn to ensure distinct ordering
		let now = 1000;
		vi.spyOn(Date, 'now').mockImplementation(() => now++);

		await queue.enqueue({ method: 'POST', url: '/api/tasks', body: { title: 'First' } });
		await queue.enqueue({ method: 'POST', url: '/api/tasks', body: { title: 'Second' } });

		vi.restoreAllMocks();

		const items = await queue.getAll();
		expect(items).toHaveLength(2);
		expect(items[0].body).toEqual({ title: 'First' });
		expect(items[1].body).toEqual({ title: 'Second' });
		expect(items[0].timestamp).toBeLessThan(items[1].timestamp);
	});

	it('remove() decrements pendingCount and notifies', async () => {
		const listener = vi.fn();
		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		queue.onChange(listener);

		const items = await queue.getAll();
		await queue.remove(items[0].id);

		expect(queue.pendingCount).toBe(0);
		expect(listener).toHaveBeenCalledOnce();
	});

	it('remove() does not go below zero', async () => {
		await queue.remove('nonexistent');
		expect(queue.pendingCount).toBe(0);
	});

	it('clear() empties the queue and resets pendingCount', async () => {
		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		await queue.enqueue({ method: 'DELETE', url: '/api/tasks/1' });
		expect(queue.pendingCount).toBe(2);

		const listener = vi.fn();
		queue.onChange(listener);
		await queue.clear();

		expect(queue.pendingCount).toBe(0);
		expect(listener).toHaveBeenCalledOnce();

		const items = await queue.getAll();
		expect(items).toHaveLength(0);
	});

	it('replay() sends mutation as fetch and returns response', async () => {
		const mockResponse = new Response('{}', { status: 200 });
		globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

		const result = await queue.replay({
			id: 'q-1',
			timestamp: 1,
			method: 'POST',
			url: '/api/tasks',
			body: { title: 'Test' },
			headers: { 'X-WS-Client-Id': 'abc' }
		});

		expect(result).toBe(mockResponse);
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WS-Client-Id': 'abc' },
			body: JSON.stringify({ title: 'Test' })
		});
	});

	it('replay() omits body for GET requests', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}'));

		await queue.replay({
			id: 'q-1',
			timestamp: 1,
			method: 'GET',
			url: '/api/tasks'
		});

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks', {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
	});

	it('replay() omits body for DELETE requests', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}'));

		await queue.replay({
			id: 'q-1',
			timestamp: 1,
			method: 'DELETE',
			url: '/api/tasks/1',
			body: { id: '1' }
		});

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' }
		});
	});

	it('replay() returns null on network failure', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

		const result = await queue.replay({
			id: 'q-1',
			timestamp: 1,
			method: 'POST',
			url: '/api/tasks'
		});

		expect(result).toBeNull();
	});

	it('handles opening DB when object store already exists', async () => {
		// First operation creates the store
		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		// Second operation reuses existing store (onupgradeneeded skips creation)
		await queue.enqueue({ method: 'POST', url: '/api/tasks' });
		const items = await queue.getAll();
		expect(items).toHaveLength(2);
	});

	it('replay() sends mutation without custom headers when none provided', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}'));

		await queue.replay({
			id: 'q-1',
			timestamp: 1,
			method: 'PATCH',
			url: '/api/tasks/1',
			body: { title: 'Updated' }
		});

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Updated' })
		});
	});
});
