import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const e2eDataDir = resolve(tmpdir(), 'prosys-e2e-data');

export default defineConfig({
	globalSetup: './e2e/global-setup.ts',
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: process.env.CI ? 'html' : 'list',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		navigationTimeout: 60_000
	},
	timeout: process.env.CI ? 60_000 : 30_000,
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } }
	],
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			PROSYS_DATA_DIR: e2eDataDir
		}
	}
});
