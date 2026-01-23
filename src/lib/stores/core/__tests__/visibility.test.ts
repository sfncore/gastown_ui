/**
 * Visibility Store Tests
 *
 * Tests for Page Visibility API integration:
 * - Initial visibility state detection
 * - Visibility change callbacks
 * - Polling interval adjustment (5000ms normal, 60000ms background)
 * - Cleanup/unsubscribe
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createVisibilityStore,
	NORMAL_POLLING_INTERVAL,
	BACKGROUND_POLLING_INTERVAL,
	type VisibilityStoreDeps,
	type VisibilityStoreInstance
} from '../visibility.svelte';

describe('Visibility Store', () => {
	let visibilityStore: VisibilityStoreInstance;
	let mockDeps: VisibilityStoreDeps;
	let hiddenStatus: boolean;
	let visibilityChangeHandler: (() => void) | null;

	beforeEach(() => {
		hiddenStatus = false;
		visibilityChangeHandler = null;

		mockDeps = {
			getHiddenStatus: () => hiddenStatus,
			addEventListener: vi.fn((event: string, handler: () => void) => {
				if (event === 'visibilitychange') {
					visibilityChangeHandler = handler;
				}
			}),
			removeEventListener: vi.fn()
		};

		visibilityStore = createVisibilityStore(mockDeps);
	});

	afterEach(() => {
		visibilityStore.destroy();
		vi.clearAllMocks();
	});

	describe('Initial Visibility State', () => {
		it('initializes with visible state when document is not hidden', () => {
			hiddenStatus = false;
			const store = createVisibilityStore(mockDeps);

			expect(store.isVisible).toBe(true);

			store.destroy();
		});

		it('initializes with hidden state when document is hidden', () => {
			hiddenStatus = true;
			const store = createVisibilityStore(mockDeps);

			expect(store.isVisible).toBe(false);

			store.destroy();
		});

		it('registers visibilitychange event listener on creation', () => {
			expect(mockDeps.addEventListener).toHaveBeenCalledWith(
				'visibilitychange',
				expect.any(Function)
			);
		});
	});

	describe('Visibility Change Detection', () => {
		it('detects when page becomes hidden', () => {
			expect(visibilityStore.isVisible).toBe(true);

			// Simulate page becoming hidden
			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(visibilityStore.isVisible).toBe(false);
		});

		it('detects when page becomes visible', () => {
			// Start hidden
			hiddenStatus = true;
			visibilityChangeHandler?.();
			expect(visibilityStore.isVisible).toBe(false);

			// Become visible
			hiddenStatus = false;
			visibilityChangeHandler?.();

			expect(visibilityStore.isVisible).toBe(true);
		});

		it('does not notify if visibility state does not change', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			// Same state (visible -> visible)
			hiddenStatus = false;
			visibilityChangeHandler?.();

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('Polling Interval Adjustment', () => {
		it('returns normal polling interval (5000ms) when visible', () => {
			expect(visibilityStore.isVisible).toBe(true);
			expect(visibilityStore.getPollingInterval()).toBe(5000);
		});

		it('returns background polling interval (60000ms) when hidden', () => {
			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(visibilityStore.isVisible).toBe(false);
			expect(visibilityStore.getPollingInterval()).toBe(60000);
		});

		it('updates polling interval when visibility changes', () => {
			// Start visible
			expect(visibilityStore.getPollingInterval()).toBe(5000);

			// Become hidden
			hiddenStatus = true;
			visibilityChangeHandler?.();
			expect(visibilityStore.getPollingInterval()).toBe(60000);

			// Become visible again
			hiddenStatus = false;
			visibilityChangeHandler?.();
			expect(visibilityStore.getPollingInterval()).toBe(5000);
		});
	});

	describe('Callback Registration and Firing', () => {
		it('calls registered callback when visibility changes', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			// Go hidden
			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(callback).toHaveBeenCalledWith(false);
		});

		it('calls callback with true when becoming visible', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			// Go hidden then visible
			hiddenStatus = true;
			visibilityChangeHandler?.();
			hiddenStatus = false;
			visibilityChangeHandler?.();

			expect(callback).toHaveBeenCalledWith(true);
		});

		it('supports multiple callbacks', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			visibilityStore.onVisibilityChange(callback1);
			visibilityStore.onVisibilityChange(callback2);
			visibilityStore.onVisibilityChange(callback3);

			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(callback1).toHaveBeenCalledWith(false);
			expect(callback2).toHaveBeenCalledWith(false);
			expect(callback3).toHaveBeenCalledWith(false);
		});

		it('handles callback that throws error gracefully', () => {
			const errorCallback = vi.fn(() => {
				throw new Error('Callback error');
			});
			const normalCallback = vi.fn();

			visibilityStore.onVisibilityChange(errorCallback);
			visibilityStore.onVisibilityChange(normalCallback);

			// Should not throw
			expect(() => {
				hiddenStatus = true;
				visibilityChangeHandler?.();
			}).not.toThrow();

			// Both callbacks should be called (error doesn't stop others)
			expect(errorCallback).toHaveBeenCalled();
			expect(normalCallback).toHaveBeenCalled();
		});
	});

	describe('Cleanup and Unsubscribe', () => {
		it('returns unsubscribe function from onVisibilityChange', () => {
			const callback = vi.fn();
			const unsubscribe = visibilityStore.onVisibilityChange(callback);

			// Go hidden
			hiddenStatus = true;
			visibilityChangeHandler?.();
			expect(callback).toHaveBeenCalledTimes(1);

			// Unsubscribe
			unsubscribe();

			// Go visible - should not trigger callback
			hiddenStatus = false;
			visibilityChangeHandler?.();
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('removes event listener on destroy', () => {
			visibilityStore.destroy();

			expect(mockDeps.removeEventListener).toHaveBeenCalledWith(
				'visibilitychange',
				expect.any(Function)
			);
		});

		it('clears callbacks on destroy', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			visibilityStore.destroy();

			// Trigger visibility change - callback should not fire
			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(callback).not.toHaveBeenCalled();
		});

		it('handles multiple unsubscribes gracefully', () => {
			const callback = vi.fn();
			const unsubscribe = visibilityStore.onVisibilityChange(callback);

			// Multiple unsubscribes should not throw
			expect(() => {
				unsubscribe();
				unsubscribe();
				unsubscribe();
			}).not.toThrow();
		});
	});

	describe('Edge Cases', () => {
		it('handles rapid visibility transitions', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			// Rapid transitions
			hiddenStatus = true;
			visibilityChangeHandler?.();
			hiddenStatus = false;
			visibilityChangeHandler?.();
			hiddenStatus = true;
			visibilityChangeHandler?.();
			hiddenStatus = false;
			visibilityChangeHandler?.();

			expect(callback).toHaveBeenCalledTimes(4);
			expect(visibilityStore.isVisible).toBe(true);
		});

		it('does not call callbacks after destroy', () => {
			const callback = vi.fn();
			visibilityStore.onVisibilityChange(callback);

			visibilityStore.destroy();

			hiddenStatus = true;
			visibilityChangeHandler?.();

			expect(callback).not.toHaveBeenCalled();
		});

		it('handles callback unsubscribing during notification', () => {
			let unsubscribe1: (() => void) | undefined;
			const callback1 = vi.fn(() => {
				unsubscribe1?.();
			});
			const callback2 = vi.fn();

			unsubscribe1 = visibilityStore.onVisibilityChange(callback1);
			visibilityStore.onVisibilityChange(callback2);

			hiddenStatus = true;
			visibilityChangeHandler?.();

			// Both should be called for this event
			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();

			// On next event, callback1 should not be called
			hiddenStatus = false;
			visibilityChangeHandler?.();
			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(2);
		});
	});
});
