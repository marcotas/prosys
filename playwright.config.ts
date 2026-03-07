import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const e2eDataDir = resolve(tmpdir(), 'prosys-e2e-data');

export default defineConfig({
	globalSetup: './e2e/global-setup.ts',
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'html' : 'list',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } }
	],
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		env: {
			PROSYS_DATA_DIR: e2eDataDir
		}
	}
});
