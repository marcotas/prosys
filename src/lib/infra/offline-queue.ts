import { ChangeNotifier } from '$lib/domain/change-notifier';

// ── Types ─────────────────────────────────────────────────

export interface QueuedMutation {
	id: string;
	timestamp: number;
	method: string;
	url: string;
	body?: unknown;
	headers?: Record<string, string>;
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
			/* istanbul ignore next -- defensive: store already exists on re-upgrade */
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		/* istanbul ignore next -- IDB open error: untestable with fake-indexeddb */
		req.onerror = () => reject(req.error);
	});
}

// ── OfflineQueue ──────────────────────────────────────────

export class OfflineQueue extends ChangeNotifier {
	private _pendingCount = 0;

	get pendingCount(): number {
		return this._pendingCount;
	}

	/** Load initial pending count from IndexedDB. */
	async init(): Promise<void> {
		const db = await openDB();
		const items = await this.idbGetAll(db);
		db.close();
		this._pendingCount = items.length;
		this.notifyChanges();
	}

	/** Add a failed mutation to the queue. */
	async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
		const entry: QueuedMutation = {
			id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			timestamp: Date.now(),
			...mutation
		};
		const db = await openDB();
		await this.idbPut(db, entry);
		db.close();
		this._pendingCount++;
		this.notifyChanges();
	}

	/** Get all queued mutations in FIFO order. */
	async getAll(): Promise<QueuedMutation[]> {
		const db = await openDB();
		const items = await this.idbGetAll(db);
		db.close();
		return items;
	}

	/** Remove a single mutation from the queue (after successful replay). */
	async remove(id: string): Promise<void> {
		const db = await openDB();
		await this.idbDelete(db, id);
		db.close();
		this._pendingCount = Math.max(0, this._pendingCount - 1);
		this.notifyChanges();
	}

	/** Clear the entire queue. */
	async clear(): Promise<void> {
		const db = await openDB();
		await this.idbClear(db);
		db.close();
		this._pendingCount = 0;
		this.notifyChanges();
	}

	/** Replay a single queued mutation against the server. Returns Response or null on network failure. */
	async replay(mutation: QueuedMutation): Promise<Response | null> {
		try {
			const init: RequestInit = {
				method: mutation.method,
				headers: { 'Content-Type': 'application/json', ...mutation.headers }
			};
			if (mutation.body !== undefined && mutation.method !== 'GET' && mutation.method !== 'DELETE') {
				init.body = JSON.stringify(mutation.body);
			}
			return await fetch(mutation.url, init);
		} catch {
			return null;
		}
	}

	// ── Private IDB helpers ─────────────────────────────────

	private idbGetAll(db: IDBDatabase): Promise<QueuedMutation[]> {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const req = store.getAll();
			req.onsuccess = () => {
				const items = (req.result as QueuedMutation[]).sort(
					(a, b) => a.timestamp - b.timestamp
				);
				resolve(items);
			};
			/* istanbul ignore next -- IDB request error: untestable with fake-indexeddb */
			req.onerror = () => reject(req.error);
		});
	}

	private idbPut(db: IDBDatabase, mutation: QueuedMutation): Promise<void> {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.put(mutation);
			tx.oncomplete = () => resolve();
			/* istanbul ignore next -- IDB transaction error: untestable with fake-indexeddb */
			tx.onerror = () => reject(tx.error);
		});
	}

	private idbDelete(db: IDBDatabase, id: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.delete(id);
			tx.oncomplete = () => resolve();
			/* istanbul ignore next -- IDB transaction error: untestable with fake-indexeddb */
			tx.onerror = () => reject(tx.error);
		});
	}

	private idbClear(db: IDBDatabase): Promise<void> {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.clear();
			tx.oncomplete = () => resolve();
			/* istanbul ignore next -- IDB transaction error: untestable with fake-indexeddb */
			tx.onerror = () => reject(tx.error);
		});
	}
}
