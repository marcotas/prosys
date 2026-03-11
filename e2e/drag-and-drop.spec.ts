import { test, expect, type Page, type Locator } from '@playwright/test';
import { cleanData, createMember, addTask, addHabit, waitForHydration, getTodayName } from './helpers';

/**
 * Drag-and-drop via Playwright mouse API.
 *
 * SortableJS runs in fallback mode (forceFallback=true) for WKWebView
 * compatibility, so it uses mouse/touch events — not native HTML5 DnD.
 * Playwright's mouse API dispatches real mouse events that trigger the
 * fallback drag mechanism.
 */
async function dragAndDrop(
	page: Page,
	source: Locator,
	target: Locator,
	options?: { targetOffsetY?: number }
) {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (!sourceBox || !targetBox) throw new Error('Could not get bounding boxes');

	const sourceX = sourceBox.x + sourceBox.width / 2;
	const sourceY = sourceBox.y + sourceBox.height / 2;
	const targetX = targetBox.x + targetBox.width / 2;
	const targetY = targetBox.y + (options?.targetOffsetY ?? targetBox.height / 2);

	// Move to source and press to initiate drag
	await page.mouse.move(sourceX, sourceY);
	await page.mouse.down();

	// Small initial move to exceed SortableJS touchStartThreshold (5px)
	// and trigger _onDragStart → _appendGhost (via _nextTick/setTimeout(0))
	const dirY = targetY < sourceY ? -10 : 10;
	await page.mouse.move(sourceX, sourceY + dirY, { steps: 3 });

	// Wait for ghostEl to be created (setTimeout(0) in _dragStarted).
	// touchEvt is only updated in _onTouchMove when ghostEl exists.
	await page.waitForTimeout(150);

	// Move toward target in slow incremental steps.
	// Each step fires pointermove → _onTouchMove → updates touchEvt.
	// Then _emulateDragOver (50ms interval) calls elementFromPoint
	// with the updated touchEvt coordinates.
	const totalSteps = 10;
	for (let i = 1; i <= totalSteps; i++) {
		const t = i / totalSteps;
		const x = sourceX + (targetX - sourceX) * t;
		const y = (sourceY + dirY) + (targetY - (sourceY + dirY)) * t;
		await page.mouse.move(x, y);
		await page.waitForTimeout(60);
	}

	// Hold at target to let SortableJS process the final position
	await page.waitForTimeout(200);

	// Release
	await page.mouse.up();
}

test.describe('Drag and drop — task reorder within day', () => {
	const today = getTodayName();

	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('reorders tasks within a day card', async ({ page }) => {
		await addTask(page, today, 'Task A');
		await addTask(page, today, 'Task B');

		const todayCard = page.getByLabel(`${today} tasks`, { exact: false });
		await expect(todayCard.getByText('Task A')).toBeVisible();
		await expect(todayCard.getByText('Task B')).toBeVisible();

		// Verify initial order
		const items = todayCard.locator('[role="listitem"]');
		await expect(items).toHaveCount(2);
		await expect(items.nth(0)).toContainText('Task A');
		await expect(items.nth(1)).toContainText('Task B');

		// Drag Task A's handle DOWN to Task B's position (bottom edge).
		// We drag downward to avoid triggering SortableJS auto-scroll,
		// which shifts items and invalidates target coordinates.
		const sourceHandle = items.nth(0).locator('.drag-handle');
		const targetItem = items.nth(1);
		const targetBBox = await targetItem.boundingBox();

		await dragAndDrop(page, sourceHandle, targetItem, {
			targetOffsetY: targetBBox!.height - 5
		});
		await page.waitForTimeout(500);

		// Verify new order: B before A
		await expect(items.nth(0)).toContainText('Task B');
		await expect(items.nth(1)).toContainText('Task A');
	});
});

test.describe('Drag and drop — task move between days', () => {
	const today = getTodayName();
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const todayIndex = dayNames.indexOf(today);
	const targetDay = dayNames[(todayIndex + 1) % 7];

	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('moves a task from one day to another', async ({ page }) => {
		await addTask(page, today, 'Moveable task');

		const sourceCard = page.getByLabel(`${today} tasks`, { exact: false });
		const targetCard = page.getByLabel(`${targetDay} tasks`, { exact: false });

		await expect(sourceCard.getByText('Moveable task')).toBeVisible();

		// Scroll the target card into view if needed
		await targetCard.scrollIntoViewIfNeeded();

		// Drag the task handle to the target day's task list
		const sourceHandle = sourceCard.locator('[role="listitem"] .drag-handle');
		const targetList = targetCard.locator('[role="list"]');

		await dragAndDrop(page, sourceHandle, targetList);

		// Wait for move to complete
		await page.waitForTimeout(500);

		// Task should appear in target day and be removed from source
		await expect(targetCard.getByText('Moveable task')).toBeVisible();
		await expect(sourceCard.getByText('Moveable task')).not.toBeVisible();
	});
});

test.describe('Drag and drop — habit reorder', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => localStorage.clear());
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('reorders habits in the tracker', async ({ page }) => {
		await addHabit(page, 'Exercise');
		await addHabit(page, 'Reading');

		const tracker = page.getByLabel('Habit tracker');
		await expect(tracker.getByLabel('Habit: Exercise')).toBeVisible();
		await expect(tracker.getByLabel('Habit: Reading')).toBeVisible();

		// Verify initial order
		const rows = tracker.locator('tbody tr[data-sort-id]');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toContainText('Exercise');
		await expect(rows.nth(1)).toContainText('Reading');

		// Drag Reading's handle above Exercise
		const sourceHandle = rows.nth(1).locator('.drag-handle');
		const targetRow = rows.nth(0);

		await dragAndDrop(page, sourceHandle, targetRow, { targetOffsetY: 5 });

		// Wait for reorder to complete
		await page.waitForTimeout(500);

		// Verify new order: Reading before Exercise
		await expect(rows.nth(0)).toContainText('Reading');
		await expect(rows.nth(1)).toContainText('Exercise');
	});
});
