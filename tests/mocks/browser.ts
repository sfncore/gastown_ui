/**
 * MSW Browser Setup
 *
 * Configures MSW for browser/development mode.
 * This intercepts fetch requests in the browser for offline development.
 *
 * Usage in development:
 * ```ts
 * // In src/hooks.client.ts or app initialization
 * if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API === 'true') {
 *   const { worker } = await import('../tests/mocks/browser');
 *   await worker.start();
 * }
 * ```
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Service Worker instance for browser mocking
 */
export const worker = setupWorker(...handlers);

/**
 * Start the worker with default options
 * Logs unhandled requests as warnings (helpful for debugging)
 */
export async function startMocking(): Promise<void> {
	await worker.start({
		onUnhandledRequest: 'warn',
		serviceWorker: {
			url: '/mockServiceWorker.js'
		}
	});
	console.log('[MSW] Mock API enabled');
}

/**
 * Stop the worker and clean up
 */
export function stopMocking(): void {
	worker.stop();
	console.log('[MSW] Mock API disabled');
}

// Re-export state utilities for runtime manipulation
export {
	resetAllStates,
	simulateGlobalFailure,
	simulateEmptyData,
	simulateAuthenticated
} from './handlers';
