/**
 * Mock API Layer
 *
 * MSW-based mocking infrastructure for testing and development.
 *
 * ## Quick Start
 *
 * ### In Tests (Vitest)
 * ```ts
 * import { server, resetAllStates, workState } from 'tests/mocks/server';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => { server.resetHandlers(); resetAllStates(); });
 * afterAll(() => server.close());
 *
 * test('handles API error', async () => {
 *   workState.shouldFail = true;
 *   // ... test error handling
 * });
 * ```
 *
 * ### In Development (Browser)
 * ```ts
 * import { startMocking } from 'tests/mocks/browser';
 * await startMocking();
 * ```
 *
 * ## State Manipulation
 *
 * Each handler group has a state object for controlling behavior:
 * - `authState` - Authentication (shouldFail, isAuthenticated, shouldExpire)
 * - `gasTownState` - Gas Town status (shouldFail, useEmptyStatus)
 * - `workState` - Issues/convoys (shouldFail, useEmptyData, slingSuccess)
 * - `workflowState` - Formulas/molecules (shouldFail, useEmptyData, cookSuccess, pourSuccess)
 *
 * ## Fixtures
 *
 * Mock data is exported from fixtures for test assertions:
 * ```ts
 * import { mockIssues, mockFormulas } from 'tests/mocks/fixtures';
 * expect(result).toEqual(mockIssues[0]);
 * ```
 */

// Main exports for test setup
export { server, setupMockServer } from './server';

// Handler exports
export {
	handlers,
	authHandlers,
	gasTownHandlers,
	workHandlers,
	workflowHandlers
} from './handlers';

// State exports for test manipulation
export {
	authState,
	gasTownState,
	workState,
	workflowState,
	resetAllStates,
	simulateGlobalFailure,
	simulateEmptyData,
	simulateAuthenticated
} from './handlers';

// Fixture exports for assertions
export * from './fixtures';
