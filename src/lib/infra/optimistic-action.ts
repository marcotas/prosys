import type { OfflineQueue } from './offline-queue';

export type OfflinePayload = {
	method: string;
	url: string;
	body?: unknown;
	headers?: Record<string, string>;
};

export interface MutationPlan<T> {
	apply(): void;
	request(): Promise<T>;
	onSuccess(result: T): void;
	offlinePayload: OfflinePayload;
}

/**
 * Detect if an error is a network error (server unreachable).
 * fetch() throws TypeError on network failure, not on HTTP error status codes.
 */
export function isNetworkError(err: unknown): boolean {
	return err instanceof TypeError && /fetch|network/i.test(err.message);
}

/**
 * Shared optimistic mutation helper.
 *
 * Flow:
 * 1. snapshot() — capture state for rollback
 * 2. apply() — optimistic local update
 * 3. notify() — trigger UI re-render
 * 4. request() — send API call
 * 5. Success: onSuccess(result) → notify()
 * 6. Network error: enqueue(offlinePayload) → return null
 * 7. Server error: restore(snapshot) → notify() → rethrow
 */
export async function optimisticAction<T>(
	collection: { snapshot(): unknown; restore(snap: unknown): void },
	offlineQueue: OfflineQueue,
	notify: () => void,
	plan: MutationPlan<T>
): Promise<T | null> {
	const snap = collection.snapshot();

	plan.apply();
	notify();

	try {
		const result = await plan.request();
		plan.onSuccess(result);
		notify();
		return result;
	} catch (err) {
		if (isNetworkError(err)) {
			await offlineQueue.enqueue(plan.offlinePayload);
			return null;
		}
		// Server error — rollback
		collection.restore(snap);
		notify();
		throw err;
	}
}
