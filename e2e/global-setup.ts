import { chromium } from '@playwright/test';

/**
 * Navigate to the app once before all tests to trigger DB migrations
 * (migrations run in +layout.server.ts on first page load).
 */
export default async function globalSetup() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	// First load triggers Vite compilation + DB migrations — can be slow on CI
	await page.goto('http://localhost:5173/', { timeout: 120_000 });
	await page.waitForLoadState('networkidle');
	await browser.close();
}
