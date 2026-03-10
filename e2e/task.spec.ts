import { test, expect } from '@playwright/test';
import { cleanData, createMember, addTask, waitForHydration, getTodayName } from './helpers';

test.describe('Task management', () => {
	// Use today's day so the task is never "past" on the current week
	const today = getTodayName();

	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('adds a task to a day card', async ({ page }) => {
		await addTask(page, today, 'Buy groceries');

		const todayCard = page.getByLabel(`${today} tasks`);
		await expect(todayCard.getByText('Buy groceries')).toBeVisible();
	});

	test('completes and uncompletes a task', async ({ page }) => {
		await addTask(page, today, 'Buy groceries');

		// Complete the task
		const checkbox = page.getByLabel('Mark Buy groceries as complete');
		await checkbox.click();
		await expect(page.getByLabel('Mark Buy groceries as incomplete')).toBeVisible();

		// Uncomplete it
		await page.getByLabel('Mark Buy groceries as incomplete').click();
		await expect(page.getByLabel('Mark Buy groceries as complete')).toBeVisible();
	});

	test('deletes a task via context menu', async ({ page }) => {
		await addTask(page, today, 'Buy groceries');

		// Right-click to open context menu
		const taskText = page.getByLabel(`${today} tasks`).getByText('Buy groceries');
		await taskText.click({ button: 'right' });

		// Click Delete in context menu
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Task should be removed
		await expect(page.getByLabel(`${today} tasks`).getByText('Buy groceries')).not.toBeVisible();
	});

	test('shows Delete (not Cancel) for current-week tasks', async ({ page }) => {
		await addTask(page, today, 'Buy groceries');

		// Right-click to open context menu
		const taskText = page.getByLabel(`${today} tasks`).getByText('Buy groceries');
		await taskText.click({ button: 'right' });

		// Should show "Delete", not "Cancel"
		await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Cancel' })).not.toBeVisible();
	});
});

test.describe('Task cancellation', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
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

test.describe('Task rescheduling', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');

		// Navigate to previous week so all days are in the past
		await page.getByLabel('Previous week').click();
	});

	test('reschedules a past task via context menu', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Right-click to open context menu and click Reschedule
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Reschedule…' }).click();

		// Reschedule picker dialog should appear
		const dialog = page.getByRole('dialog', { name: 'Reschedule' });
		await expect(dialog).toBeVisible();

		// Navigate to next month to pick a future date, then click the 15th
		await dialog.getByLabel('Next month').click();
		await dialog.getByRole('button', { name: '15' }).click();

		// Original task should show rescheduled icon
		await expect(sundayCard.getByLabel('Rescheduled')).toBeVisible();

		// Title should have line-through styling
		const titleSpan = sundayCard.getByText('Clean house');
		await expect(titleSpan).toHaveClass(/line-through/);
	});

	test('rescheduled task hides context menu actions', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Reschedule the task
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Reschedule…' }).click();
		const dialog = page.getByRole('dialog', { name: 'Reschedule' });
		await dialog.getByLabel('Next month').click();
		await dialog.getByRole('button', { name: '15' }).click();
		await expect(sundayCard.getByLabel('Rescheduled')).toBeVisible();

		// Right-click the rescheduled task
		await sundayCard.getByText('Clean house').click({ button: 'right' });

		// Context menu should not show Reschedule or Cancel/Delete actions
		await expect(page.getByRole('menuitem', { name: 'Reschedule…' })).not.toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Cancel' })).not.toBeVisible();
	});

	test('rescheduled task cannot be toggled', async ({ page }) => {
		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Reschedule the task
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Reschedule…' }).click();
		const dialog = page.getByRole('dialog', { name: 'Reschedule' });
		await dialog.getByLabel('Next month').click();
		await dialog.getByRole('button', { name: '15' }).click();
		await expect(sundayCard.getByLabel('Rescheduled')).toBeVisible();

		// Checkbox should not be present for rescheduled tasks
		await expect(page.getByLabel('Mark Clean house as complete')).not.toBeVisible();
	});

	test('rescheduled task is excluded from progress', async ({ page }) => {
		// Add two tasks
		await addTask(page, 'Sunday', 'Clean house');
		await addTask(page, 'Sunday', 'Cook dinner');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Header should show 0/2
		await expect(sundayCard.getByText('0/2')).toBeVisible();

		// Reschedule one task
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Reschedule…' }).click();
		const dialog = page.getByRole('dialog', { name: 'Reschedule' });
		await dialog.getByLabel('Next month').click();
		await dialog.getByRole('button', { name: '15' }).click();
		await expect(sundayCard.getByLabel('Rescheduled')).toBeVisible();

		// Header should now show 0/1 (rescheduled task excluded)
		await expect(sundayCard.getByText('0/1')).toBeVisible();
	});
});

test.describe('Undo delete/cancel (F-167)', () => {
	const today = getTodayName();

	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('shows undo toast on delete and restores task when undo is clicked', async ({ page }) => {
		await addTask(page, today, 'Buy groceries');

		const todayCard = page.getByLabel(`${today} tasks`);
		await expect(todayCard.getByText('Buy groceries')).toBeVisible();

		// Delete via context menu
		await todayCard.getByText('Buy groceries').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Task should be removed immediately
		await expect(todayCard.getByText('Buy groceries')).not.toBeVisible();

		// Undo toast should appear
		const undoToast = page.getByText('Task deleted');
		await expect(undoToast).toBeVisible();

		// Click Undo
		await page.getByRole('button', { name: 'Undo' }).click();

		// Task should reappear
		await expect(todayCard.getByText('Buy groceries')).toBeVisible();
	});

	test('shows undo toast on cancel and restores task when undo is clicked', async ({ page }) => {
		// Navigate to previous week so tasks are in the past
		await page.getByLabel('Previous week').click();

		await addTask(page, 'Sunday', 'Clean house');

		const sundayCard = page.getByLabel('Sunday tasks');

		// Cancel via context menu
		await sundayCard.getByText('Clean house').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Cancel' }).click();

		// Task should be marked as cancelled
		await expect(sundayCard.getByLabel('Cancelled')).toBeVisible();

		// Undo toast should appear
		const undoToast = page.getByText('Task cancelled');
		await expect(undoToast).toBeVisible();

		// Click Undo
		await page.getByRole('button', { name: 'Undo' }).click();

		// Task should be restored to active state (no cancelled icon)
		await expect(sundayCard.getByLabel('Cancelled')).not.toBeVisible();
		await expect(sundayCard.getByText('Clean house')).toBeVisible();
	});
});

test.describe('Stale task self-healing (F-170)', () => {
	const today = getTodayName();

	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('removes stale task when server returns 404 on toggle', async ({ page }) => {
		await addTask(page, today, 'Phantom task');

		const todayCard = page.getByLabel(`${today} tasks`);
		await expect(todayCard.getByText('Phantom task')).toBeVisible();

		// Intercept the next PATCH to return 404 (simulates task deleted on another device)
		await page.route('**/api/tasks/*', async (route) => {
			if (route.request().method() === 'PATCH') {
				await route.fulfill({
					status: 404,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Task not found' })
				});
			} else {
				await route.continue();
			}
		});

		// Toggle the task — PATCH returns 404, onNotFound removes it
		await page.getByLabel('Mark Phantom task as complete').click();

		// Task should disappear (self-healed via 404 handling)
		await expect(todayCard.getByText('Phantom task')).not.toBeVisible();
	});

	test('removes stale task when server returns 404 on delete', async ({ page }) => {
		await addTask(page, today, 'Ghost task');

		const todayCard = page.getByLabel(`${today} tasks`);
		await expect(todayCard.getByText('Ghost task')).toBeVisible();

		// Intercept the next DELETE to return 404
		await page.route('**/api/tasks/*', async (route) => {
			if (route.request().method() === 'DELETE') {
				await route.fulfill({
					status: 404,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Task not found' })
				});
			} else {
				await route.continue();
			}
		});

		// Delete via context menu — DELETE returns 404, handled gracefully
		await todayCard.getByText('Ghost task').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Task should disappear
		await expect(todayCard.getByText('Ghost task')).not.toBeVisible();
	});
});
