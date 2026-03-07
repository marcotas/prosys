import { describe, it, expect, vi } from 'vitest';
import { optimisticAction, isNetworkError } from './optimistic-action';
import type { MutationPlan } from './optimistic-action';
import type { OfflineQueue } from './offline-queue';

// ── isNetworkError ──────────────────────────────────────

describe('isNetworkError', () => {
	it('returns true for TypeError with "fetch" in message', () => {
		expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
	});

	it('returns true for TypeError with "network" in message', () => {
		expect(isNetworkError(new TypeError('NetworkError when attempting'))).toBe(true);
	});

	it('returns false for TypeError with unrelated message', () => {
		expect(isNetworkError(new TypeError('Cannot read properties'))).toBe(false);
	});

	it('returns false for non-TypeError', () => {
		expect(isNetworkError(new Error('Failed to fetch'))).toBe(false);
	});

	it('returns false for non-Error values', () => {
		expect(isNetworkError('Failed to fetch')).toBe(false);
		expect(isNetworkError(null)).toBe(false);
		expect(isNetworkError(undefined)).toBe(false);
	});
});

// ── optimisticAction ────────────────────────────────────

function createMocks() {
	const collection = {
		snapshot: vi.fn(() => 'snap'),
		restore: vi.fn()
	};
	const offlineQueue = {
		enqueue: vi.fn()
	} as unknown as OfflineQueue;
	const notify = vi.fn();
	return { collection, offlineQueue, notify };
}

describe('optimisticAction', () => {
	it('success path: snapshot → apply → notify → request → onSuccess → notify', async () => {
		const { collection, offlineQueue, notify } = createMocks();
		const serverResult = { id: '1', title: 'created' };

		const plan: MutationPlan<typeof serverResult> = {
			apply: vi.fn(),
			request: vi.fn().mockResolvedValue(serverResult),
			onSuccess: vi.fn(),
			offlinePayload: { method: 'POST', url: '/api/tasks' }
		};

		const result = await optimisticAction(collection, offlineQueue, notify, plan);

		expect(result).toEqual(serverResult);
		expect(collection.snapshot).toHaveBeenCalledOnce();
		expect(plan.apply).toHaveBeenCalledOnce();
		expect(notify).toHaveBeenCalledTimes(2);
		expect(plan.request).toHaveBeenCalledOnce();
		expect(plan.onSuccess).toHaveBeenCalledWith(serverResult);
		expect(collection.restore).not.toHaveBeenCalled();
		expect(offlineQueue.enqueue).not.toHaveBeenCalled();
	});

	it('network error path: enqueue offline payload and return null', async () => {
		const { collection, offlineQueue, notify } = createMocks();

		const plan: MutationPlan<unknown> = {
			apply: vi.fn(),
			request: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
			onSuccess: vi.fn(),
			offlinePayload: { method: 'POST', url: '/api/tasks', body: { title: 'test' } }
		};

		const result = await optimisticAction(collection, offlineQueue, notify, plan);

		expect(result).toBeNull();
		expect(offlineQueue.enqueue).toHaveBeenCalledWith(plan.offlinePayload);
		expect(collection.restore).not.toHaveBeenCalled();
		expect(plan.onSuccess).not.toHaveBeenCalled();
		// notify called once for apply, not again for rollback
		expect(notify).toHaveBeenCalledTimes(1);
	});

	it('server error path: rollback, notify, and rethrow', async () => {
		const { collection, offlineQueue, notify } = createMocks();
		const serverError = new Error('Server error');

		const plan: MutationPlan<unknown> = {
			apply: vi.fn(),
			request: vi.fn().mockRejectedValue(serverError),
			onSuccess: vi.fn(),
			offlinePayload: { method: 'POST', url: '/api/tasks' }
		};

		await expect(optimisticAction(collection, offlineQueue, notify, plan)).rejects.toThrow(
			'Server error'
		);

		expect(collection.restore).toHaveBeenCalledWith('snap');
		expect(notify).toHaveBeenCalledTimes(2); // once for apply, once for rollback
		expect(offlineQueue.enqueue).not.toHaveBeenCalled();
		expect(plan.onSuccess).not.toHaveBeenCalled();
	});
});
