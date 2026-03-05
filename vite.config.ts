import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { Bonjour } from 'bonjour-service';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * Vite plugin that attaches a WebSocket server and mDNS broadcast
 * to the dev HTTP server. Handles upgrade requests on the `/ws` path.
 */
function prosysWs(): Plugin {
	let bonjour: InstanceType<typeof Bonjour> | null = null;

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

			// Start mDNS broadcast once the server is listening
			server.httpServer?.once('listening', () => {
				const addr = server.httpServer?.address();
				const port = typeof addr === 'object' && addr ? addr.port : 5173;

				bonjour = new Bonjour();
				bonjour.publish({
					name: 'ProSys',
					type: 'prosys',
					protocol: 'tcp',
					port,
					probe: false
				});

				console.log(`mDNS: broadcasting _prosys._tcp on port ${port}`);
			});
		},

		// Clean up mDNS on server close
		buildEnd() {
			if (bonjour) {
				bonjour.unpublishAll();
				bonjour.destroy();
				bonjour = null;
			}
		}
	};
}

const isTest = process.env.VITEST === 'true';

export default defineConfig(({ command }) => ({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	plugins: isTest ? [] : [prosysWs(), tailwindcss(), sveltekit()],

	test: {
		include: ['src/lib/domain/**/*.test.ts', 'src/lib/adapters/**/*.test.ts', 'src/lib/server/**/*.test.ts'],
		alias: {
			'$lib': resolve(__dirname, 'src/lib')
		},
		coverage: {
			provider: 'istanbul',
			include: ['src/lib/domain/**/*.ts'],
			exclude: ['**/*.test.ts', '**/*.d.ts'],
			reporter: ['text', 'html', 'json'],
			thresholds: {
				'src/lib/domain/**/*.ts': {
					statements: 100,
					branches: 100,
					functions: 100,
					lines: 100
				}
			}
		}
	},

	// Force Vite to bundle all pure-JS dependencies into the SSR output so
	// the Tauri production build doesn't need to ship node_modules for them.
	// Only native addons (better-sqlite3) stay external.
	//
	// In dev mode, ws and qrcode are also kept external because their CJS
	// internals use require() which breaks in Vite's ESM-based SSR loader.
	// In production builds, Vite properly transforms CJS → ESM, so they
	// can be safely bundled (and MUST be, since the Tauri server-bundle
	// doesn't ship them in node_modules).
	ssr: {
		noExternal: true,
		external:
			command === 'serve'
				? ['better-sqlite3', 'ws', 'qrcode']
				: ['better-sqlite3']
	}
} satisfies UserConfig));
