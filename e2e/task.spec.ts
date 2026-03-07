import { test, expect } from '@playwright/test';
import { cleanData, createMember, addTask } from './helpers';

test.describe('Task management', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await createMember(page, 'Alice');
	});

	test('adds a task to a day card', async ({ page }) => {
		await addTask(page, 'Sunday', 'Buy groceries');

		// Task should appear in the Sunday card
		const sundayCard = page.getByLabel('Sunday tasks');
		await expect(sundayCard.getByText('Buy groceries')).toBeVisible();
	});

	test('completes and uncompletes a task', async ({ page }) => {
		await addTask(page, 'Sunday', 'Buy groceries');

		// Complete the task
		const checkbox = page.getByLabel('Mark Buy groceries as complete');
		await checkbox.click();
		await expect(page.getByLabel('Mark Buy groceries as incomplete')).toBeVisible();

		// Uncomplete it
		await page.getByLabel('Mark Buy groceries as incomplete').click();
		await expect(page.getByLabel('Mark Buy groceries as complete')).toBeVisible();
	});

	test('deletes a task via context menu', async ({ page }) => {
		await addTask(page, 'Sunday', 'Buy groceries');

		// Right-click to open context menu
		const taskText = page.getByLabel('Sunday tasks').getByText('Buy groceries');
		await taskText.click({ button: 'right' });

		// Click Delete in context menu
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Task should be removed
		await expect(page.getByLabel('Sunday tasks').getByText('Buy groceries')).not.toBeVisible();
	});
});
