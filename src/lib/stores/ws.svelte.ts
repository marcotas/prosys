import type { WSMessage } from '$lib/types';

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

// ── Store ────────────────────────────────────────────────

function createWsStore() {
	let connected = $state(false);
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelay = 1000;
	let destroyed = false;

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

	return {
		get connected() {
			return connected;
		},

		/**
		 * Register a handler for a specific WSMessage type.
		 * Returns an unsubscribe function.
		 */
		onMessage(type: WSMessage['type'], handler: (payload: any) => void): () => void {
			handlers.set(type, handler);
			return () => handlers.delete(type);
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
