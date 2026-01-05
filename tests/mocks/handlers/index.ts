/**
 * MSW Handlers Index
 *
 * Combines all API handlers for use with MSW
 */

import { authHandlers, authState } from './auth';
import { gasTownHandlers, gasTownState } from './gastown';
import { workHandlers, workState } from './work';
import { workflowHandlers, workflowState } from './workflows';

/** All handlers combined for MSW setup */
export const handlers = [
	...authHandlers,
	...gasTownHandlers,
	...workHandlers,
	...workflowHandlers
];

/** Export individual handler groups for selective use */
export { authHandlers, gasTownHandlers, workHandlers, workflowHandlers };

/** Export state objects for test manipulation */
export { authState, gasTownState, workState, workflowState };

/**
 * Reset all mock states to defaults
 * Call this in beforeEach/afterEach to ensure clean test state
 */
export function resetAllStates(): void {
	// Auth state
	authState.isAuthenticated = false;
	authState.shouldFail = false;
	authState.shouldExpire = false;

	// Gas Town state
	gasTownState.shouldFail = false;
	gasTownState.useEmptyStatus = false;
	gasTownState.errorMessage = 'Failed to fetch status';

	// Work state
	workState.shouldFail = false;
	workState.useEmptyData = false;
	workState.slingSuccess = true;
	workState.errorMessage = 'Failed to fetch work items';

	// Workflow state
	workflowState.shouldFail = false;
	workflowState.useEmptyData = false;
	workflowState.cookSuccess = true;
	workflowState.pourSuccess = true;
	workflowState.errorMessage = 'Failed to process workflow';
}

/**
 * Simulate global failure state
 * Useful for testing error boundaries and fallback UI
 */
export function simulateGlobalFailure(): void {
	authState.shouldFail = true;
	gasTownState.shouldFail = true;
	workState.shouldFail = true;
	workflowState.shouldFail = true;
}

/**
 * Simulate empty data state
 * Useful for testing empty states and onboarding flows
 */
export function simulateEmptyData(): void {
	gasTownState.useEmptyStatus = true;
	workState.useEmptyData = true;
	workflowState.useEmptyData = true;
}

/**
 * Simulate authenticated session
 * Sets up a logged-in user state
 */
export function simulateAuthenticated(): void {
	authState.isAuthenticated = true;
	authState.shouldFail = false;
	authState.shouldExpire = false;
}
