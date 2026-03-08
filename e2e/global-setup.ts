import { chromium } from '@playwright/test';

/**
 * Navigate to the app once before all tests to trigger DB migrations
 * (migrations run in +layout.server.ts on first page load).
 */
export default async function globalSetup() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	// First load triggers Vite compilation + DB migrations — can be slow on CI.
	// Use 'load' instead of 'networkidle' — SvelteKit's HMR WebSocket keeps
	// the connection alive, so networkidle never resolves in dev mode.
	await page.goto('http://localhost:5173/', { timeout: 120_000, waitUntil: 'load' });
	// Wait for Svelte hydration so Vite compiles both SSR and client bundles.
	// Without this, the first test hits a cold client compilation and times out.
	await page.locator('[data-hydrated]').waitFor({ timeout: 120_000 });
	await browser.close();
}
