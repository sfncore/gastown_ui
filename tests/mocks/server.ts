/**
 * MSW Server Setup
 *
 * Configures MSW for Node.js test environments.
 * This intercepts fetch requests in tests for reliable, isolated testing.
 *
 * Usage in tests:
 * ```ts
 * import { server } from '../mocks/server';
 * import { resetAllStates, workState } from '../mocks/handlers';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => {
 *   server.resetHandlers();
 *   resetAllStates();
 * });
 * afterAll(() => server.close());
 *
 * it('handles error state', async () => {
 *   workState.shouldFail = true;
 *   // ... test error handling
 * });
 * ```
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server instance for Node.js mocking
 */
export const server = setupServer(...handlers);

/**
 * Setup function for Vitest global setup
 * Add to vitest.config.ts setupFiles
 */
export function setupMockServer(): void {
	// Start server before all tests
	beforeAll(() => {
		server.listen({
			onUnhandledRequest: 'error'
		});
	});

	// Reset handlers and state after each test
	afterEach(() => {
		server.resetHandlers();
	});

	// Clean up after all tests
	afterAll(() => {
		server.close();
	});
}

// Re-export everything for convenience
export { handlers } from './handlers';
export {
	authHandlers,
	gasTownHandlers,
	workHandlers,
	workflowHandlers,
	authState,
	gasTownState,
	workState,
	workflowState,
	resetAllStates,
	simulateGlobalFailure,
	simulateEmptyData,
	simulateAuthenticated
} from './handlers';

// Re-export fixtures for test assertions
export * from './fixtures';
