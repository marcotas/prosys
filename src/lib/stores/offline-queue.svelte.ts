/**
 * Offline mutation queue — IndexedDB-backed FIFO queue for failed API mutations.
 *
 * When the server is unreachable, mutations are stored here instead of being
 * rolled back. When the WebSocket reconnects, the queue is drained in order.
 */

// ── Types ─────────────────────────────────────────────────

export interface QueuedMutation {
	id: string;
	timestamp: number;
	method: string;
	url: string;
	body?: unknown;
	headers: Record<string, string>;
}

// ── IndexedDB helpers ─────────────────────────────────────

const DB_NAME = 'prosys-offline';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGetAll(): Promise<QueuedMutation[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.getAll();
		req.onsuccess = () => {
			// Sort by timestamp to preserve FIFO order
			const items = (req.result as QueuedMutation[]).sort(
				(a, b) => a.timestamp - b.timestamp
			);
			resolve(items);
		};
		req.onerror = () => reject(req.error);
		tx.oncomplete = () => db.close();
	});
}

async function idbPut(mutation: QueuedMutation): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.put(mutation);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

async function idbDelete(id: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.delete(id);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

async function idbClear(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.clear();
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

// ── Store ─────────────────────────────────────────────────

function createOfflineQueue() {
	let pendingCount = $state(0);

	// Load initial count from IndexedDB
	if (typeof indexedDB !== 'undefined') {
		idbGetAll()
			.then((items) => {
				pendingCount = items.length;
			})
			.catch(() => {
				// IndexedDB not available (SSR or error) — ignore
			});
	}

	return {
		get pendingCount() {
			return pendingCount;
		},

		/**
		 * Add a failed mutation to the queue.
		 */
		async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
			const entry: QueuedMutation = {
				id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				timestamp: Date.now(),
				...mutation
			};
			await idbPut(entry);
			pendingCount++;
		},

		/**
		 * Get all queued mutations in FIFO order.
		 */
		async getAll(): Promise<QueuedMutation[]> {
			return idbGetAll();
		},

		/**
		 * Remove a single mutation from the queue (after successful replay).
		 */
		async remove(id: string): Promise<void> {
			await idbDelete(id);
			pendingCount = Math.max(0, pendingCount - 1);
		},

		/**
		 * Clear the entire queue.
		 */
		async clear(): Promise<void> {
			await idbClear();
			pendingCount = 0;
		},

		/**
		 * Replay a single queued mutation against the server.
		 * Returns the server response, or null if the request failed.
		 */
		async replay(mutation: QueuedMutation): Promise<Response | null> {
			try {
				const init: RequestInit = {
					method: mutation.method,
					headers: { 'Content-Type': 'application/json', ...mutation.headers }
				};
				if (mutation.body !== undefined && mutation.method !== 'GET' && mutation.method !== 'DELETE') {
					init.body = JSON.stringify(mutation.body);
				}
				const res = await fetch(mutation.url, init);
				return res;
			} catch {
				// Network still down
				return null;
			}
		}
	};
}

export const offlineQueue = createOfflineQueue();

// ── Utility ───────────────────────────────────────────────

/**
 * Detect if an error is a network error (server unreachable).
 * fetch() throws TypeError on network failure, not on HTTP error status codes.
 */
export function isNetworkError(err: unknown): boolean {
	return err instanceof TypeError && /fetch|network/i.test(err.message);
}
