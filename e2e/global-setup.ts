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
	await browser.close();
}
