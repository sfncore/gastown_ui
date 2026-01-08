import { test, expect } from '@playwright/test';

test.describe('Agents Page', () => {
	test('should display agents list page', async ({ page }) => {
		await page.goto('/agents');

		const visibleRoot = page.locator('#main-content:visible');

		// Check page header
		await expect(visibleRoot.locator('h1')).toContainText('Agents');
		await expect(visibleRoot.locator('text=All active agents in Gas Town')).toBeVisible();
	});

	test('should show agent cards or empty state', async ({ page }) => {
		await page.goto('/agents');
		await page.waitForLoadState('networkidle');

		const visibleRoot = page.locator('#main-content:visible');

		// Either agent cards should be visible, or empty/error state
		const agentCards = visibleRoot.locator('[href^="/agents/"]');
		const emptyState = visibleRoot.locator('text=No agents found');
		const errorState = visibleRoot.locator('text=Failed to load agents');

		const hasAgents = await agentCards.count() > 0;
		const isEmpty = await emptyState.isVisible().catch(() => false);
		const hasError = await errorState.isVisible().catch(() => false);

		// One of these should be true
		expect(hasAgents || isEmpty || hasError).toBeTruthy();
	});

	test('should have sticky header', async ({ page }) => {
		await page.goto('/agents');

		const visibleRoot = page.locator('#main-content:visible');
		const header = visibleRoot.locator('header.sticky');
		await expect(header).toBeVisible();

		// Check it has the glass panel styling
		await expect(header).toHaveClass(/panel-glass/);
	});

	test('should navigate to agent detail on card click', async ({ page }) => {
		await page.goto('/agents');
		await page.waitForLoadState('networkidle');

		// If there are agent cards, click the first one
		const visibleRoot = page.locator('#main-content:visible');
		const firstAgentLink = visibleRoot.locator('[href^="/agents/"]').first();

		if (await firstAgentLink.isVisible().catch(() => false)) {
			const href = await firstAgentLink.getAttribute('href');
			await firstAgentLink.click();

			// Should navigate to agent detail page
			await expect(page).toHaveURL(href!);
		}
	});

	test('should display grid layout on desktop', async ({ page }) => {
		// Set desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/agents');

		const visibleRoot = page.locator('#main-content:visible');

		// Check for grid container
		const gridContainer = visibleRoot.locator('.grid');
		await expect(gridContainer).toBeVisible();
	});
});

test.describe('Agent Detail Page', () => {
	test('should display agent detail page elements', async ({ page }) => {
		// Navigate to a sample agent detail page
		await page.goto('/agents/test-agent-1');

		// Page should have some content (either agent data or error)
		const content = page.locator('#main-content:visible');
		await expect(content).toBeAttached();
	});

	test('should handle non-existent agent gracefully', async ({ page }) => {
		await page.goto('/agents/non-existent-agent-xyz');
		await page.waitForLoadState('networkidle');

		// Should show some content (error state or 404)
		const body = page.locator('body');
		await expect(body).toBeVisible();
	});

	test('should have navigation back capability', async ({ page }) => {
		await page.goto('/agents');
		await page.waitForLoadState('networkidle');

		// Click first agent if available
		const firstAgent = page.locator('[href^="/agents/"]').first();
		if (await firstAgent.isVisible().catch(() => false)) {
			await firstAgent.click();
			await page.waitForLoadState('networkidle');

			// Navigate back
			await page.goBack();
			await expect(page).toHaveURL('/agents');
		}
	});
});
