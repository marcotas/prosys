import { test, expect, type Page, type Locator } from '@playwright/test';
import { cleanData, createMember, addTask, addHabit, waitForHydration, getTodayName } from './helpers';

/**
 * Drag-and-drop via Chrome DevTools Protocol (CDP).
 *
 * SortableJS uses native HTML5 DnD (forceFallback=false), which requires
 * real drag events (dragstart/dragenter/dragover/drop). Playwright's mouse
 * API only dispatches mouse events which don't trigger the native DnD
 * sequence for cross-container drags.
 *
 * CDP's Input.setInterceptDrags + Input.dispatchDragEvent dispatches
 * trusted drag events at the browser input layer, making this work in
 * headless Chromium.
 */
async function dragAndDrop(
	page: Page,
	source: Locator,
	target: Locator,
	options?: { targetOffsetY?: number }
) {
	const cdp = await page.context().newCDPSession(page);

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (!sourceBox || !targetBox) throw new Error('Could not get bounding boxes');

	const sourceX = sourceBox.x + sourceBox.width / 2;
	const sourceY = sourceBox.y + sourceBox.height / 2;
	const targetX = targetBox.x + targetBox.width / 2;
	const targetY = targetBox.y + (options?.targetOffsetY ?? targetBox.height / 2);

	// Enable drag interception — Chrome will capture drag data and emit
	// Input.dragIntercepted instead of performing the default drag.
	await cdp.send('Input.setInterceptDrags', { enabled: true });

	// Mouse press on source handle
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		x: sourceX,
		y: sourceY,
		button: 'left',
		clickCount: 1
	});

	// Move slightly to initiate native drag (triggers dragstart)
	const dragData = await new Promise<{ data: DragData }>((resolve) => {
		cdp.on('Input.dragIntercepted', (params: { data: DragData }) => resolve(params));

		// Small movements to trigger the drag threshold
		void cdp.send('Input.dispatchMouseEvent', {
			type: 'mouseMoved',
			x: sourceX,
			y: sourceY + 10,
			button: 'left'
		});
	});

	// Dispatch drag events on the target
	await cdp.send('Input.dispatchDragEvent', {
		type: 'dragEnter',
		x: targetX,
		y: targetY,
		data: dragData.data
	});

	// Multiple dragOver events for SortableJS to calculate position
	for (let i = 0; i < 3; i++) {
		await cdp.send('Input.dispatchDragEvent', {
			type: 'dragOver',
			x: targetX,
			y: targetY,
			data: dragData.data
		});
	}

	await cdp.send('Input.dispatchDragEvent', {
		type: 'drop',
		x: targetX,
		y: targetY,
		data: dragData.data
	});

	// Release mouse
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		x: targetX,
		y: targetY,
		button: 'left',
		clickCount: 1
	});

	await cdp.send('Input.setInterceptDrags', { enabled: false });
	await cdp.detach();
}

// Type for CDP drag data (not exported by Playwright)
interface DragData {
	items: Array<{ mimeType: string; data: string }>;
	dragOperationsMask: number;
	files?: string[];
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

		// Drag Task B's handle to Task A's position (above it)
		const sourceHandle = items.nth(1).locator('.drag-handle');
		const targetItem = items.nth(0);

		await dragAndDrop(page, sourceHandle, targetItem, { targetOffsetY: 5 });

		// Wait for reorder to complete
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
