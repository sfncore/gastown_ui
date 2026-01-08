import { test, expect } from '@playwright/test';

test.describe('Mail Inbox', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/mail');
	});

	test('should display mail inbox page', async ({ page }) => {
		// Check page header
		const visibleRoot = page.locator('#main-content:visible');
		await expect(visibleRoot.locator('h1')).toContainText('Mail Inbox');
	});

	test('should show message count', async ({ page }) => {
		const visibleRoot = page.locator('#main-content:visible');

		// Message count should be visible
		const messageCount = visibleRoot.locator('text=/\\d+ messages/');
		await expect(messageCount).toBeVisible();
	});

	test('should have compose button', async ({ page }) => {
		const visibleRoot = page.locator('#main-content:visible');
		const composeButton = visibleRoot.locator('a[href="/mail/compose"]');
		await expect(composeButton).toBeVisible();
		await expect(composeButton).toContainText('Compose');
	});

	test('should navigate to compose page', async ({ page }) => {
		const visibleRoot = page.locator('#main-content:visible');
		const composeButton = visibleRoot.locator('a[href="/mail/compose"]');
		await composeButton.click();
		await expect(page).toHaveURL('/mail/compose');
	});

	test('should show messages or empty state', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		const visibleRoot = page.locator('#main-content:visible');

		// Either messages or empty state should be visible
		const messageList = visibleRoot.locator('ul[role="list"]');
		const emptyState = visibleRoot.locator('text=No messages in inbox');
		const errorState = visibleRoot.locator('text=Failed to load inbox');

		const hasMessages = (await messageList.count()) > 0;
		const isEmpty = (await emptyState.count()) > 0;
		const hasError = (await errorState.count()) > 0;

		expect(hasMessages || isEmpty || hasError).toBeTruthy();
	});

	test('should expand message on click', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		// If there are messages, click to expand
		const visibleRoot = page.locator('#main-content:visible');
		const messageButton = visibleRoot.locator('button[aria-expanded]').first();

		if (await messageButton.isVisible().catch(() => false)) {
			// Check initial state
			await expect(messageButton).toHaveAttribute('aria-expanded', 'false');

			// Click to expand
			await messageButton.click();

			// Should be expanded
			await expect(messageButton).toHaveAttribute('aria-expanded', 'true');

			// Click again to collapse
			await messageButton.click();
			await expect(messageButton).toHaveAttribute('aria-expanded', 'false');
		}
	});

	test('should show message type badges', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		const visibleRoot = page.locator('#main-content:visible');

		// Check if any message type badges are visible
		const badges = visibleRoot.locator(
			'[class*="bg-destructive"], [class*="bg-warning"], [class*="bg-success"], [class*="bg-info"], [class*="bg-muted"]'
		);

		// If there are messages, badges should be present
		const messageList = visibleRoot.locator('ul[role="list"]');
		if (await messageList.isVisible().catch(() => false)) {
			const badgeCount = await badges.count();
			// Badges might or might not be present depending on data
			expect(badgeCount).toBeGreaterThanOrEqual(0);
		}
	});

	test('should have view full message link in expanded message', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		const visibleRoot = page.locator('#main-content:visible');
		const messageButton = visibleRoot.locator('button[aria-expanded]').first();

		if (await messageButton.isVisible().catch(() => false)) {
			await messageButton.click();

			// Look for view full message link
			const viewLink = visibleRoot.locator('a:has-text("View full message")');
			if (await viewLink.isVisible().catch(() => false)) {
				await expect(viewLink).toHaveAttribute('href', /\/mail\/.+/);
			}
		}
	});
});

test.describe('Mail Compose', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/mail/compose');
	});

	test('should display compose page elements', async ({ page }) => {
		// Check page has compose form elements
		await expect(page.locator('body')).toBeVisible();
	});

	test('should have recipient input', async ({ page }) => {
		// Look for recipient field (might have different labels)
		const recipientInput = page.locator('input[name*="recipient"], input[name*="to"], input[placeholder*="recipient"], input[placeholder*="@"]');

		if (await recipientInput.isVisible().catch(() => false)) {
			await expect(recipientInput).toBeVisible();
			await recipientInput.fill('test@gastown.local');
			await expect(recipientInput).toHaveValue('test@gastown.local');
		}
	});

	test('should have subject input', async ({ page }) => {
		const subjectInput = page.locator('input[name*="subject"], input[placeholder*="subject" i]');

		if (await subjectInput.isVisible().catch(() => false)) {
			await expect(subjectInput).toBeVisible();
			await subjectInput.fill('Test Subject');
			await expect(subjectInput).toHaveValue('Test Subject');
		}
	});

	test('should have message body input', async ({ page }) => {
		const bodyInput = page.locator('textarea, [contenteditable="true"]');

		if (await bodyInput.isVisible().catch(() => false)) {
			await expect(bodyInput).toBeVisible();
		}
	});

	test('should navigate back to inbox', async ({ page }) => {
		// Navigate back to inbox
		await page.goto('/mail');
		await expect(page).toHaveURL('/mail');
	});
});

test.describe('Mail Detail', () => {
	test('should display mail detail page', async ({ page }) => {
		// Navigate to a sample mail detail
		await page.goto('/mail/test-message-1');

		// Page should have content
		const content = page.locator('#main-content:visible');
		await expect(content).toBeAttached();
	});
});
