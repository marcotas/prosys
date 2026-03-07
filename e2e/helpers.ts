import type { Page } from '@playwright/test';

/**
 * Delete all members via API (cascades to tasks/habits), then reload.
 */
export async function cleanData(page: Page) {
	const baseURL = 'http://localhost:5173';
	const res = await page.request.get(`${baseURL}/api/members`);
	if (!res.ok()) return;
	const members = await res.json() as { id: string }[];
	for (const m of members) {
		await page.request.delete(`${baseURL}/api/members/${m.id}`);
	}
}

/**
 * Create a member via the UI. Works from both the welcome screen
 * and the main dashboard.
 */
export async function createMember(page: Page, name: string) {
	// Use .or() to avoid TOCTOU race between welcome screen and dashboard
	const trigger = page.getByRole('button', { name: 'Create First Profile' })
		.or(page.getByLabel('Add family member'));

	const dialog = page.getByRole('dialog', { name: 'New Profile' });

	// Retry click if dialog doesn't appear (SSR hydration race on CI)
	for (let attempt = 0; attempt < 3; attempt++) {
		await trigger.click();
		try {
			await dialog.waitFor({ timeout: 5_000 });
			break;
		} catch {
			if (attempt === 2) throw new Error('Dialog did not appear after 3 click attempts');
		}
	}
	await dialog.locator('#profile-name').fill(name);
	await dialog.getByRole('button', { name: 'Create Profile' }).click();
	await dialog.waitFor({ state: 'hidden' });
}

/**
 * Add a task to a day card by name (e.g. "Sunday").
 */
export async function addTask(page: Page, dayName: string, title: string) {
	const input = page.getByLabel(`Add task to ${dayName}`);
	await input.fill(title);
	await input.press('Enter');
}

/**
 * Add a habit via the habit tracker input.
 */
export async function addHabit(page: Page, name: string) {
	// Wait for habit tracker to mount (dashboard renders after member creation)
	const tracker = page.getByLabel('Habit tracker');
	await tracker.waitFor();

	// Expand if collapsed
	const input = page.getByLabel('Add new habit');
	if (!(await input.isVisible())) {
		await tracker.getByRole('button').first().click();
		await input.waitFor();
	}
	// Click input to focus, then type to ensure Svelte bind:value updates
	await input.click();
	await input.pressSequentially(name, { delay: 30 });
	await input.press('Enter');
	// Wait for the habit to appear (optimistic update renders the contenteditable span)
	await page.getByLabel(`Habit: ${name}`).waitFor();
}
