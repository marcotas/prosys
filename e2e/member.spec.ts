import { test, expect } from '@playwright/test';
import { cleanData, createMember } from './helpers';

test.describe('Member management', () => {
	test.beforeEach(async ({ page }) => {
		await cleanData(page);
		await page.goto('/', { waitUntil: 'networkidle' });
	});

	test('shows welcome screen when no members exist', async ({ page }) => {
		await expect(page.getByText('Welcome to ProSys')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create First Profile' })).toBeVisible();
	});

	test('creates a family member from welcome screen', async ({ page }) => {
		await createMember(page, 'Alice');

		// Dashboard should load with the member's name visible
		await expect(page.getByLabel("Edit Alice's profile")).toBeVisible();
	});

	test('creates a second member and switches between them', async ({ page }) => {
		await createMember(page, 'Alice');
		await createMember(page, 'Bob');

		// Bob should now be selected (last created)
		await expect(page.getByLabel("Edit Bob's profile")).toBeVisible();

		// Switch to Alice
		await page.getByLabel("View Alice's dashboard").click();
		await expect(page.getByLabel("Edit Alice's profile")).toBeVisible();
	});

	test('edits a member name', async ({ page }) => {
		await createMember(page, 'Alice');

		// Open edit dialog
		await page.getByLabel("Edit Alice's profile").click();

		const dialog = page.getByRole('dialog', { name: 'Edit Profile' });
		await dialog.waitFor();

		// Clear and type new name
		const nameInput = dialog.locator('#profile-name');
		await nameInput.clear();
		await nameInput.fill('Alicia');
		await dialog.getByRole('button', { name: 'Save Changes' }).click();
		await dialog.waitFor({ state: 'hidden' });

		// Verify updated name
		await expect(page.getByLabel("Edit Alicia's profile")).toBeVisible();
	});
});
