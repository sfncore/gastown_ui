/**
 * Stagger Animation Utilities
 *
 * Provides dynamic stagger delays for lists with more than 8 items.
 * CSS handles items 1-8 via nth-child selectors, this utility handles 9+.
 *
 * @example
 * // In a Svelte component
 * import { applyStaggerDelays, STAGGER_DELAY } from '$lib/stagger';
 *
 * // Apply to a container with many items
 * function handleMount(container: HTMLElement) {
 *   applyStaggerDelays(container);
 * }
 *
 * // Or use the action
 * <ul use:stagger>
 *   {#each items as item}
 *     <li class="animate-blur-fade-up">{item}</li>
 *   {/each}
 * </ul>
 */

/** Default stagger delay in milliseconds (matches CSS --delay-stagger) */
export const STAGGER_DELAY = 50;

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply stagger delays to children of a container.
 * Handles items beyond the 8 that CSS nth-child covers.
 * Uses requestAnimationFrame to batch DOM writes and prevent layout thrashing.
 *
 * @param container - The parent element with .stagger class
 * @param delayMs - Delay between each item (default: 50ms)
 */
export function applyStaggerDelays(
	container: HTMLElement,
	delayMs: number = STAGGER_DELAY
): void {
	if (prefersReducedMotion()) return;

	// Batch DOM writes in a single animation frame to prevent layout thrashing
	requestAnimationFrame(() => {
		const children = container.children;
		const length = children.length;

		// Only need to handle items 9+ (0-indexed: 8+)
		// Items 1-8 are handled by CSS nth-child selectors
		for (let i = 8; i < length; i++) {
			const child = children[i] as HTMLElement;
			child.style.setProperty('--stagger-delay', `${i * delayMs}ms`);
		}
	});
}

/**
 * Clear stagger delays from children.
 * Uses requestAnimationFrame to batch DOM writes and prevent layout thrashing.
 *
 * @param container - The parent element
 */
export function clearStaggerDelays(container: HTMLElement): void {
	requestAnimationFrame(() => {
		const children = container.children;
		const length = children.length;
		for (let i = 0; i < length; i++) {
			const child = children[i] as HTMLElement;
			child.style.removeProperty('--stagger-delay');
		}
	});
}

/**
 * Svelte action for applying stagger delays.
 * Uses debounced MutationObserver to prevent layout thrashing from rapid updates.
 *
 * @example
 * <ul use:stagger>
 *   {#each items as item}
 *     <li class="animate-blur-fade-up">{item}</li>
 *   {/each}
 * </ul>
 *
 * // With custom delay
 * <ul use:stagger={{ delay: 75 }}>
 */
export function stagger(
	node: HTMLElement,
	options: { delay?: number } = {}
): { update: (options: { delay?: number }) => void; destroy: () => void } {
	let currentDelay = options.delay ?? STAGGER_DELAY;
	let rafId: number | null = null;

	// Initial application
	applyStaggerDelays(node, currentDelay);

	// Debounced handler to prevent rapid re-application
	const handleMutation = () => {
		// Cancel any pending RAF to debounce rapid mutations
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}
		rafId = requestAnimationFrame(() => {
			applyStaggerDelays(node, currentDelay);
			rafId = null;
		});
	};

	// Set up mutation observer to handle dynamic content
	const observer = new MutationObserver(handleMutation);
	observer.observe(node, { childList: true });

	return {
		update(newOptions: { delay?: number }) {
			currentDelay = newOptions.delay ?? STAGGER_DELAY;
			clearStaggerDelays(node);
			applyStaggerDelays(node, currentDelay);
		},
		destroy() {
			observer.disconnect();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
			clearStaggerDelays(node);
		}
	};
}
