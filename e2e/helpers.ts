import type { Page } from '@playwright/test';

/**
 * Wait for SvelteKit hydration to complete.
 * The connection indicator only renders when `browser` is true (client-side),
 * so its presence proves that Svelte has mounted and hydrated the layout.
 */
export async function waitForHydration(page: Page) {
	await page.getByText('Real-time sync active').or(
		page.getByText('Server unreachable')
	).waitFor({ timeout: 30_000 });
}

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
 * and the main dashboard. Callers must await waitForHydration() first.
 */
export async function createMember(page: Page, name: string) {
	// Use .or() to avoid TOCTOU race between welcome screen and dashboard
	const trigger = page.getByRole('button', { name: 'Create First Profile' })
		.or(page.getByLabel('Add family member'));

	await trigger.click();

	const dialog = page.getByRole('dialog', { name: 'New Profile' });
	await dialog.waitFor();
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
