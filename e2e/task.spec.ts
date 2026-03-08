import { test, expect } from '@playwright/test';
import { cleanData, createMember, addTask } from './helpers';

test.describe('Task management', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/', { waitUntil: 'load' });
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

	test('shows Delete (not Cancel) for current-week tasks', async ({ page }) => {
		await addTask(page, 'Sunday', 'Buy groceries');

		// Right-click to open context menu
		const taskText = page.getByLabel('Sunday tasks').getByText('Buy groceries');
		await taskText.click({ button: 'right' });

		// Should show "Delete", not "Cancel"
		await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Cancel' })).not.toBeVisible();
	});
});

test.describe('Task cancellation', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/', { waitUntil: 'load' });
		await createMember(page, 'Alice');

		// Navigate to previous week so all days are in the past
		await page.getByLabel('Previous week').click();
	});

	test('cancels a past task via context menu', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Right-click to open context menu
		await sundayCard.getByText('Clean house').click({ button: 'right' });

		// Past tasks show "Cancel" instead of "Delete"
		await expect(page.getByRole('menuitem', { name: 'Cancel' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Delete' })).not.toBeVisible();

		// Cancel the task
		await page.getByRole('menuitem', { name: 'Cancel' }).click();

		// Task should still be visible (not removed like delete)
		await expect(sundayCard.getByText('Clean house')).toBeVisible();

		// Should show cancelled icon
		await expect(sundayCard.getByLabel('Cancelled')).toBeVisible();

		// Title should have line-through styling
		const titleSpan = sundayCard.getByText('Clean house');
		await expect(titleSpan).toHaveClass(/line-through/);
	});

	test('cancelled task hides context menu actions', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Cancel the task first
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Cancel' }).click();
		await expect(sundayCard.getByLabel('Cancelled')).toBeVisible();

		// Right-click the cancelled task
		await sundayCard.getByText('Clean house').click({ button: 'right' });

		// Context menu should not show Reschedule or Cancel actions
		await expect(page.getByRole('menuitem', { name: 'Reschedule…' })).not.toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Cancel' })).not.toBeVisible();
	});

	test('cancelled task cannot be toggled', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Cancel the task
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Cancel' }).click();
		await expect(sundayCard.getByLabel('Cancelled')).toBeVisible();

		// Checkbox should not be present for cancelled tasks
		await expect(page.getByLabel('Mark Clean house as complete')).not.toBeVisible();

		// Cancelled icon should be present instead
		await expect(sundayCard.getByLabel('Cancelled')).toBeVisible();
	});
});
