/**
 * Visibility Store - Page Visibility API Integration
 *
 * Provides:
 * - Real-time page visibility tracking via Page Visibility API
 * - Callback registration for visibility state changes
 * - Dynamic polling interval adjustment for background optimization
 * - Proper cleanup and memory management
 *
 * Background Mode Optimization:
 * When the page is hidden (user switches tabs, minimizes browser),
 * polling intervals are extended from 5s to 60s to conserve resources.
 *
 * @module stores/core/visibility
 */

// Browser detection without SvelteKit dependency (works in all contexts)
const browser = typeof window !== 'undefined';

/**
 * Polling interval when page is visible (5 seconds)
 */
export const NORMAL_POLLING_INTERVAL = 5000;

/**
 * Polling interval when page is hidden/background (60 seconds)
 * Reduces resource usage when user is not actively viewing the page
 */
export const BACKGROUND_POLLING_INTERVAL = 60000;

/**
 * Callback type for visibility change subscriptions
 * @param isVisible - true when page becomes visible, false when hidden
 */
export type VisibilityChangeCallback = (isVisible: boolean) => void;

/**
 * Dependencies for testable visibility store factory
 * Uses dependency injection pattern for easy testing without browser APIs
 */
export interface VisibilityStoreDeps {
	/** Get current hidden status (true = hidden, false = visible) */
	getHiddenStatus: () => boolean;
	/** Add event listener for visibility changes */
	addEventListener: (event: string, handler: () => void) => void;
	/** Remove event listener for cleanup */
	removeEventListener: (event: string, handler: () => void) => void;
}

/**
 * Visibility store instance interface
 */
export interface VisibilityStoreInstance {
	/** Whether the page is currently visible to the user */
	readonly isVisible: boolean;
	/** Subscribe to visibility changes, returns unsubscribe function */
	onVisibilityChange(callback: VisibilityChangeCallback): () => void;
	/** Get appropriate polling interval based on current visibility */
	getPollingInterval(): number;
	/** Cleanup and destroy the store instance */
	destroy(): void;
}

/**
 * Default browser dependencies using Page Visibility API
 */
const defaultDeps: VisibilityStoreDeps = {
	getHiddenStatus: () => (browser ? document.hidden : false),
	addEventListener: (event, handler) => browser && document.addEventListener(event, handler),
	removeEventListener: (event, handler) => browser && document.removeEventListener(event, handler)
};

/**
 * Create a visibility store instance with optional custom dependencies
 *
 * @param deps - Optional dependencies for testing
 * @returns Visibility store instance
 *
 * @example
 * ```typescript
 * // Production usage
 * const visibility = createVisibilityStore();
 *
 * // Subscribe to visibility changes
 * const unsubscribe = visibility.onVisibilityChange((isVisible) => {
 *   if (isVisible) {
 *     console.log('Page is now visible - resuming normal polling');
 *   } else {
 *     console.log('Page hidden - reducing polling frequency');
 *   }
 * });
 *
 * // Get polling interval for background-aware polling
 * const interval = visibility.getPollingInterval();
 * // Returns 5000 when visible, 60000 when hidden
 *
 * // Cleanup when done
 * unsubscribe();
 * visibility.destroy();
 * ```
 */
export function createVisibilityStore(
	deps: VisibilityStoreDeps = defaultDeps
): VisibilityStoreInstance {
	// Internal state
	let isVisible = !deps.getHiddenStatus();
	let callbacks: VisibilityChangeCallback[] = [];
	let destroyed = false;

	/**
	 * Handle visibility change event from browser
	 */
	const handleVisibilityChange = (): void => {
		if (destroyed) return;

		const wasVisible = isVisible;
		isVisible = !deps.getHiddenStatus();

		// Only notify if state actually changed
		if (wasVisible !== isVisible) {
			// Iterate over a copy to handle callbacks that unsubscribe themselves
			const callbacksCopy = [...callbacks];
			for (const callback of callbacksCopy) {
				try {
					callback(isVisible);
				} catch (error) {
					// Log but don't rethrow - one callback failing shouldn't affect others
					if (typeof console !== 'undefined') {
						console.error('[VisibilityStore] Callback error:', error);
					}
				}
			}
		}
	};

	// Initialize event listener
	deps.addEventListener('visibilitychange', handleVisibilityChange);

	return {
		get isVisible(): boolean {
			return isVisible;
		},

		onVisibilityChange(callback: VisibilityChangeCallback): () => void {
			callbacks.push(callback);

			// Return unsubscribe function
			return () => {
				const index = callbacks.indexOf(callback);
				if (index > -1) {
					callbacks.splice(index, 1);
				}
			};
		},

		getPollingInterval(): number {
			return isVisible ? NORMAL_POLLING_INTERVAL : BACKGROUND_POLLING_INTERVAL;
		},

		destroy(): void {
			destroyed = true;
			callbacks = [];
			deps.removeEventListener('visibilitychange', handleVisibilityChange);
		}
	};
}

/**
 * Singleton instance for application-wide use
 *
 * @example
 * ```typescript
 * import { visibilityStore } from '$lib/stores/core/visibility.svelte';
 *
 * // Check visibility before polling
 * if (visibilityStore.isVisible) {
 *   await fetchData();
 * }
 *
 * // Use visibility-aware polling interval
 * setInterval(fetchData, visibilityStore.getPollingInterval());
 * ```
 */
export const visibilityStore = createVisibilityStore();
