import type { WSMessage } from '$lib/types';
import { offlineQueue } from './offline-queue.svelte';

// ── Client ID ────────────────────────────────────────────

let clientId = '';

/** Get the current WS client ID (empty string if not yet connected). */
export function getWsClientId(): string {
	return clientId;
}

/** Returns headers object with the WS client ID for API fetch calls. */
export function wsHeaders(): Record<string, string> {
	return clientId ? { 'X-WS-Client-Id': clientId } : {};
}

// ── Message handler registry ─────────────────────────────

type MessageHandler = (payload: unknown) => void;
const handlers = new Map<string, MessageHandler>();

// ── Sync callback registry ───────────────────────────────
// Registered by +layout.svelte to refresh data after queue drain

type SyncCallback = () => Promise<void>;
let onSyncCallback: SyncCallback | null = null;

// ── Store ────────────────────────────────────────────────

function createWsStore() {
	let connected = $state(false);
	let syncing = $state(false);
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelay = 1000;
	let destroyed = false;
	let wasDisconnected = false;

	const MAX_RECONNECT_DELAY = 30_000;

	function connect() {
		if (destroyed) return;

		// Generate a stable client ID per session
		if (!clientId) {
			try {
				clientId = crypto.randomUUID();
			} catch {
				// crypto.randomUUID() requires a secure context (HTTPS/localhost).
				// Fall back to a manual ID for LAN HTTP connections.
				clientId = 'fallback-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
			}
		}

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const url = `${protocol}//${location.host}/ws`;

		try {
			ws = new WebSocket(url);
		} catch {
			scheduleReconnect();
			return;
		}

		ws.onopen = () => {
			connected = true;
			reconnectDelay = 1000; // Reset backoff on success
			// Identify ourselves to the server
			ws?.send(JSON.stringify({ type: 'init', clientId }));

			// If we were disconnected, drain the offline queue and refresh
			if (wasDisconnected) {
				wasDisconnected = false;
				drainQueueAndRefresh();
			}
		};

		ws.onmessage = (event) => {
			try {
				const msg: WSMessage = JSON.parse(event.data);
				const handler = handlers.get(msg.type);
				if (handler) {
					handler(msg.payload);
				}
			} catch {
				// Ignore malformed messages
			}
		};

		ws.onclose = () => {
			connected = false;
			wasDisconnected = true;
			ws = null;
			if (!destroyed) scheduleReconnect();
		};

		ws.onerror = () => {
			// onclose will fire after onerror, triggering reconnect
			ws?.close();
		};
	}

	function scheduleReconnect() {
		if (destroyed || reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
			connect();
		}, reconnectDelay);
	}

	/**
	 * Drain the offline queue by replaying each mutation sequentially,
	 * then trigger a full data refresh via the registered callback.
	 */
	async function drainQueueAndRefresh() {
		const queue = await offlineQueue.getAll();
		if (queue.length === 0 && onSyncCallback) {
			// No queued mutations, but still refresh to pick up remote changes
			try {
				await onSyncCallback();
			} catch {
				// Refresh failed — will try again next reconnect
			}
			return;
		}
		if (queue.length === 0) return;

		syncing = true;

		for (const mutation of queue) {
			const res = await offlineQueue.replay(mutation);
			if (res === null) {
				// Network still down — stop draining, keep remaining in queue
				syncing = false;
				return;
			}
			// Remove from queue regardless of status code:
			// - 2xx: success
			// - 404: resource was deleted by another device — drop silently
			// - 4xx/5xx: mutation is invalid or server error — drop to avoid infinite retry
			await offlineQueue.remove(mutation.id);
		}

		// After draining, trigger full data refresh to reconcile state
		if (onSyncCallback) {
			try {
				await onSyncCallback();
			} catch {
				// Refresh failed — data may be stale until next interaction
			}
		}

		syncing = false;
	}

	return {
		get connected() {
			return connected;
		},

		get syncing() {
			return syncing;
		},

		/**
		 * Register a handler for a specific WSMessage type.
		 * Returns an unsubscribe function.
		 */
		onMessage(type: WSMessage['type'], handler: (payload: any) => void): () => void {
			handlers.set(type, handler);
			return () => handlers.delete(type);
		},

		/**
		 * Register a callback that refreshes all store data after queue drain.
		 * Called with the current member/week context from +layout.svelte.
		 */
		onSync(callback: SyncCallback): () => void {
			onSyncCallback = callback;
			return () => {
				onSyncCallback = null;
			};
		},

		/** Start the WebSocket connection. Call once on mount. */
		init() {
			destroyed = false;
			connect();
		},

		/** Tear down the connection and stop reconnecting. */
		destroy() {
			destroyed = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			if (ws) {
				ws.onclose = null; // Prevent reconnect on intentional close
				ws.close();
				ws = null;
			}
			connected = false;
		}
	};
}

export const wsStore = createWsStore();
