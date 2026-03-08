import { test, expect } from '@playwright/test';
import { cleanData, createMember } from './helpers';

test.describe('Week navigation', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/', { waitUntil: 'load' });
		await createMember(page, 'Alice');
	});

	test('navigates to previous and next week', async ({ page }) => {
		const weekNav = page.getByRole('navigation', { name: 'Week navigation' });
		const weekLabel = weekNav.locator('.tabular-nums');

		const initialText = await weekLabel.textContent();

		// Go to previous week
		await weekNav.getByLabel('Previous week').click();
		await expect(weekLabel).not.toHaveText(initialText!);

		// Go back to next week
		await weekNav.getByLabel('Next week').click();
		await expect(weekLabel).toHaveText(initialText!);
	});

	test('today button returns to current week', async ({ page }) => {
		const weekNav = page.getByRole('navigation', { name: 'Week navigation' });

		// Navigate away from current week
		await weekNav.getByLabel('Previous week').click();
		await weekNav.getByLabel('Previous week').click();

		// Today button should be visible
		const todayBtn = weekNav.getByLabel('Go to current week');
		await expect(todayBtn).toBeVisible();

		// Click it
		await todayBtn.click();

		// Today button should disappear (we're back on current week)
		await expect(todayBtn).not.toBeVisible();
	});
});
