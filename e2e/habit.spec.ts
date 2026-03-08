import { test, expect } from '@playwright/test';
import { cleanData, createMember, addHabit, waitForHydration } from './helpers';

const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

test.describe('Habit management', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before any navigation so HabitTracker starts expanded
		await page.addInitScript(() => localStorage.clear());
		await cleanData(page);
		await page.goto('/');
		await waitForHydration(page);
		await createMember(page, 'Alice');
	});

	test('adds a habit', async ({ page }) => {
		await addHabit(page, 'Exercise');

		// Habit should appear in the tracker
		await expect(page.getByLabel('Habit: Exercise')).toBeVisible();
	});

	test('toggles habit completion for a day', async ({ page }) => {
		await addHabit(page, 'Exercise');

		// Toggle Sunday (dayIndex 0)
		const dayLabel = `Exercise, ${dayAbbreviations[0]}`;
		const cell = page.getByLabel(dayLabel);
		await cell.click();

		// Should be checked
		await expect(cell).toHaveAttribute('aria-checked', 'true');

		// Toggle off
		await cell.click();
		await expect(cell).toHaveAttribute('aria-checked', 'false');
	});

	test('deletes a habit via API and verifies UI update', async ({ page }) => {
		await addHabit(page, 'Exercise');
		await expect(page.getByLabel('Habit: Exercise')).toBeVisible();

		// Delete is swipe-only (touch gesture), so delete via API and reload
		const members = await (await page.request.get('http://localhost:5173/api/members')).json() as { id: string }[];
		// Use correct query param name: "week"
		const today = new Date();
		const day = today.getDay();
		const weekStart = new Date(today.getTime() - day * 86400000).toISOString().split('T')[0];
		const habits = await (await page.request.get(`http://localhost:5173/api/members/${members[0].id}/habits?week=${weekStart}`)).json() as { id: string }[];
		for (const h of habits) {
			await page.request.delete(`http://localhost:5173/api/habits/${h.id}`);
		}
		await page.reload();

		// Habit should be removed
		await expect(page.getByLabel('Habit tracker').getByText('Exercise')).not.toBeVisible();
	});
});
