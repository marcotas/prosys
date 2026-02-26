/**
 * ProSys — Production server entry point.
 *
 * Serves the SvelteKit app via adapter-node's handler, attaches WebSocket
 * support on /ws, broadcasts the service via mDNS, and binds to 0.0.0.0
 * so LAN devices can connect.
 *
 * Usage:
 *   node server.js                        (defaults: HOST=0.0.0.0, PORT=3000)
 *   PORT=8080 HOST=0.0.0.0 node server.js
 */

import { handler } from './build/handler.js';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Bonjour } from 'bonjour-service';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ── Global WS client registry ────────────────────────────
// Matches the globalThis.__wsClients pattern used by the built
// SvelteKit API routes (broadcast() reads from this same map).

globalThis.__wsClients = globalThis.__wsClients || new Map();

// ── HTTP server ──────────────────────────────────────────

const server = createServer((req, res) => {
	// Prevent WKWebView from HTTP-caching HTML pages and the service worker.
	// Without this, after an app update the WebView may serve stale assets
	// from its disk cache (~/Library/Caches/prosys/) even when the Node.js
	// server is returning the new version's files.
	// Hashed static assets (_app/immutable/) are safe to cache — SvelteKit
	// gives them unique filenames per build.
	const url = req.url?.split('?')[0] ?? '';
	if (
		url === '/service-worker.js' ||
		(!url.startsWith('/_app/immutable/') &&
			(url.endsWith('.html') || url === '/' || !url.includes('.')))
	) {
		res.setHeader('Cache-Control', 'no-store');
	}
	handler(req, res);
});

// ── WebSocket server ─────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
	let clientId = '';

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());
			if (msg.type === 'init' && typeof msg.clientId === 'string') {
				clientId = msg.clientId;
				globalThis.__wsClients.set(clientId, ws);
			}
		} catch {
			// Ignore malformed messages
		}
	});

	ws.on('close', () => {
		if (clientId) globalThis.__wsClients.delete(clientId);
	});

	ws.on('error', () => {
		if (clientId) globalThis.__wsClients.delete(clientId);
	});
});

server.on('upgrade', (req, socket, head) => {
	if (req.url === '/ws') {
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit('connection', ws, req);
		});
	} else {
		socket.destroy();
	}
});

// ── mDNS broadcast ───────────────────────────────────────

const bonjour = new Bonjour();
const mdnsService = bonjour.publish({
	name: 'ProSys',
	type: 'prosys',
	protocol: 'tcp',
	port: PORT
});

// ── Start listening ──────────────────────────────────────

server.listen(PORT, HOST, () => {
	console.log(`ProSys server listening on http://${HOST}:${PORT}`);
	console.log(`mDNS: broadcasting _prosys._tcp on port ${PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────

function shutdown() {
	console.log('Shutting down…');
	mdnsService.stop?.();
	bonjour.unpublishAll();
	bonjour.destroy();

	// Close all WebSocket connections
	for (const [, ws] of globalThis.__wsClients) {
		ws.close();
	}
	globalThis.__wsClients.clear();

	server.close(() => {
		process.exit(0);
	});

	// Force exit after 5 seconds if graceful shutdown stalls
	setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
