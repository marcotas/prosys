/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * ProSys Service Worker — caches app shell for offline PWA support.
 *
 * Strategy:
 * - Precache all build assets and static files on install
 * - Cache-first for immutable build assets (they have content hashes)
 * - Network-first with cache fallback for navigation (HTML pages)
 * - Network-only for API requests (never cache stale data)
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `prosys-cache-${version}`;

// Assets to precache: build output (JS/CSS with hashes) + static files (icons, manifest)
const PRECACHE_ASSETS = [...build, ...files];

// ── Install: precache app shell ───────────────────────────

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => sw.skipWaiting())
	);
});

// ── Activate: clean old caches ────────────────────────────

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => sw.clients.claim())
	);
});

// ── Fetch: route requests by strategy ─────────────────────

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests (mutations are handled by the offline queue in the app)
	if (request.method !== 'GET') return;

	// Skip WebSocket upgrade requests
	if (request.headers.get('upgrade') === 'websocket') return;

	// Network-only for API requests — never serve stale data
	if (url.pathname.startsWith('/api/')) return;

	// Navigation requests (HTML pages): network-first, cache fallback
	if (request.mode === 'navigate') {
		event.respondWith(networkFirstThenCache(request));
		return;
	}

	// Build assets and static files: cache-first (immutable, hashed filenames)
	if (PRECACHE_ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirstThenNetwork(request));
		return;
	}

	// Everything else (e.g. Google Fonts): network-first, cache fallback
	event.respondWith(networkFirstThenCache(request));
});

// ── Strategies ────────────────────────────────────────────

async function cacheFirstThenNetwork(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(CACHE_NAME);
		cache.put(request, response.clone());
	}
	return response;
}

async function networkFirstThenCache(request: Request): Promise<Response> {
	try {
		const response = await fetch(request);
		// Cache successful responses for offline fallback
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		// Network failed — try cache
		const cached = await caches.match(request);
		if (cached) return cached;

		// Last resort for navigation: return cached root page
		if (request.mode === 'navigate') {
			const root = await caches.match('/');
			if (root) return root;
		}

		// Nothing in cache either
		return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
	}
}
