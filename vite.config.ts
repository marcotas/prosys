import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Vite plugin that attaches a WebSocket server to the dev HTTP server.
 * Handles upgrade requests on the `/ws` path.
 */
function prosysWs(): Plugin {
	return {
		name: 'prosys-ws',
		configureServer(server) {
			// Use ssrLoadModule so Vite resolves $lib aliases and TypeScript
			server.ssrLoadModule('/src/lib/server/ws.ts').then(({ setupWsServer }) => {
				const wss = setupWsServer();

				server.httpServer?.on('upgrade', (req, socket, head) => {
					if (req.url === '/ws') {
						wss.handleUpgrade(req, socket, head, (ws: import('ws').WebSocket) => {
							wss.emit('connection', ws, req);
						});
					}
				});
			});
		}
	};
}

export default defineConfig({
	plugins: [prosysWs(), tailwindcss(), sveltekit()]
});
