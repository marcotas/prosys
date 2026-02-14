import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage } from '$lib/types';

// ── Global client registry ──────────────────────────────
// Shared via globalThis so both the Vite plugin (dev) and
// SvelteKit API routes can access the same client map.

const g = globalThis as unknown as { __wsClients: Map<string, WebSocket> };
if (!g.__wsClients) g.__wsClients = new Map();

function getClients(): Map<string, WebSocket> {
	return g.__wsClients;
}

// ── Setup ────────────────────────────────────────────────

/**
 * Create a WebSocket server in noServer mode.
 * The caller (Vite plugin or production server.js) is responsible
 * for wiring HTTP upgrade events to wss.handleUpgrade().
 */
export function setupWsServer(): WebSocketServer {
	const wss = new WebSocketServer({ noServer: true });

	wss.on('connection', (ws: WebSocket) => {
		let clientId = '';

		ws.on('message', (raw) => {
			try {
				const msg = JSON.parse(raw.toString());
				if (msg.type === 'init' && typeof msg.clientId === 'string') {
					clientId = msg.clientId;
					getClients().set(clientId, ws);
				}
			} catch {
				// Ignore malformed messages
			}
		});

		ws.on('close', () => {
			if (clientId) getClients().delete(clientId);
		});

		ws.on('error', () => {
			if (clientId) getClients().delete(clientId);
		});
	});

	return wss;
}

// ── Broadcast ────────────────────────────────────────────

/**
 * Send a WSMessage to every connected client except the one
 * identified by `excludeClientId` (the mutation originator).
 */
export function broadcast(msg: WSMessage, excludeClientId?: string): void {
	const payload = JSON.stringify(msg);
	for (const [id, ws] of getClients()) {
		if (id !== excludeClientId && ws.readyState === WebSocket.OPEN) {
			ws.send(payload);
		}
	}
}
