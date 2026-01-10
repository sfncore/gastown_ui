<script lang="ts">
	/**
	 * PullToRefresh Component
	 *
	 * Touch-enabled pull-to-refresh gesture with visual feedback.
	 * Includes debouncing and accessible refresh button alternative.
	 *
	 * @example
	 * <PullToRefresh onRefresh={async () => await fetchData()}>
	 *   <div>Scrollable content here</div>
	 * </PullToRefresh>
	 */
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import { RefreshCw } from 'lucide-svelte';

	const pullToRefresh = tv({
		slots: {
			container: 'relative overflow-hidden touch-pan-y',
			indicator: 'absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-200',
			spinner: 'rounded-full border-2 border-muted border-t-accent animate-spin',
			content: 'transition-transform duration-200 ease-out will-change-transform',
			refreshButton: 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-1/2 focus:-translate-x-1/2 focus:z-10 focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md'
		},
		variants: {
			size: {
				sm: { indicator: 'h-8', spinner: 'w-4 h-4' },
				md: { indicator: 'h-10', spinner: 'w-5 h-5' },
				lg: { indicator: 'h-12', spinner: 'w-6 h-6' }
			},
			state: {
				idle: { indicator: 'opacity-0 -top-10' },
				pulling: { indicator: 'opacity-100' },
				refreshing: { indicator: 'opacity-100' },
				complete: { indicator: 'opacity-0 -top-10' }
			}
		},
		defaultVariants: {
			size: 'md',
			state: 'idle'
		}
	});

	type PullToRefreshVariants = VariantProps<typeof pullToRefresh>;

	interface PullToRefreshProps {
		/** Callback when refresh is triggered - should return a Promise */
		onRefresh: () => Promise<void>;
		/** Size variant */
		size?: PullToRefreshVariants['size'];
		/** Pull distance threshold to trigger refresh (default: 80) */
		threshold?: number;
		/** Maximum pull distance (default: 120) */
		maxPull?: number;
		/** Debounce time in ms between refreshes (default: 1000) */
		debounceMs?: number;
		/** Disable pull-to-refresh */
		disabled?: boolean;
		/** Additional CSS classes */
		class?: string;
		/** Content to display */
		children?: Snippet;
	}

	let {
		onRefresh,
		size = 'md',
		threshold = 80,
		maxPull = 120,
		debounceMs = 1000,
		disabled = false,
		class: className,
		children
	}: PullToRefreshProps = $props();

	// State
	let pullDistance = $state(0);
	let startY = $state(0);
	let isPulling = $state(false);
	let isRefreshing = $state(false);
	let lastRefreshTime = $state(0);
	let containerEl: HTMLDivElement;

	// Computed
	type RefreshState = 'idle' | 'pulling' | 'refreshing' | 'complete';
	const currentState = $derived<RefreshState>(
		isRefreshing ? 'refreshing' : isPulling ? 'pulling' : 'idle'
	);
	const styles = $derived(pullToRefresh({ size, state: currentState }));
	const progress = $derived(Math.min(1, pullDistance / threshold));
	const rotation = $derived(progress * 360);

	function canRefresh(): boolean {
		if (disabled || isRefreshing) return false;
		const now = Date.now();
		return now - lastRefreshTime >= debounceMs;
	}

	function isAtTop(): boolean {
		if (!containerEl) return true;
		const scrollableParent = containerEl.closest('[data-scrollable]') || containerEl;
		return scrollableParent.scrollTop <= 0;
	}

	function handleTouchStart(e: TouchEvent) {
		if (!canRefresh() || !isAtTop()) return;
		startY = e.touches[0].clientY;
		isPulling = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || !canRefresh()) return;

		const currentY = e.touches[0].clientY;
		const deltaY = currentY - startY;

		// Only allow pull down
		if (deltaY < 0) {
			resetPull();
			return;
		}

		// Apply resistance curve for natural feel
		const resistance = 0.5;
		const adjustedDelta = deltaY * resistance;
		pullDistance = Math.min(maxPull, adjustedDelta);

		// Prevent scroll while pulling
		if (pullDistance > 10) {
			e.preventDefault();
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;

		if (pullDistance >= threshold && canRefresh()) {
			await triggerRefresh();
		} else {
			resetPull();
		}
	}

	async function triggerRefresh() {
		isRefreshing = true;
		pullDistance = threshold; // Lock at threshold during refresh
		lastRefreshTime = Date.now();

		try {
			await onRefresh();
		} finally {
			isRefreshing = false;
			resetPull();
		}
	}

	function resetPull() {
		pullDistance = 0;
		isPulling = false;
	}

	async function handleRefreshButton() {
		if (canRefresh()) {
			await triggerRefresh();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'F5' || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
			// Let browser handle native refresh
			return;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={containerEl}
	class={cn(styles.container(), className)}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	ontouchcancel={handleTouchEnd}
	onkeydown={handleKeyDown}
	role="region"
	aria-label="Pull to refresh content"
>
	<!-- Accessible refresh button (visible on focus) -->
	<button
		class={styles.refreshButton()}
		onclick={handleRefreshButton}
		disabled={!canRefresh()}
		aria-label={isRefreshing ? 'Refreshing...' : 'Refresh content'}
	>
		{isRefreshing ? 'Refreshing...' : 'Refresh'}
	</button>

	<!-- Pull indicator -->
	<div
		class={styles.indicator()}
		style="top: {Math.max(-40, pullDistance - 50)}px"
		role="status"
		aria-live="polite"
		aria-label={isRefreshing ? 'Refreshing' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
	>
		{#if isRefreshing}
			<div class={styles.spinner()} aria-hidden="true"></div>
		{:else}
			<RefreshCw
				class="w-5 h-5 text-muted-foreground transition-transform"
				style="transform: rotate({rotation}deg)"
				aria-hidden="true"
			/>
		{/if}
	</div>

	<!-- Content wrapper -->
	<div
		class={styles.content()}
		style="transform: translateY({pullDistance}px)"
	>
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
