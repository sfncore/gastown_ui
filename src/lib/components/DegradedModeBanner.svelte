<script lang="ts">
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import { AlertTriangle, Radio, WifiOff, Info, X, RefreshCw } from 'lucide-svelte';
	import { networkState } from '$lib/stores/network.svelte';

	interface Props {
		/** Additional classes */
		class?: string;
		/** Check interval in milliseconds */
		checkInterval?: number;
	}

	let { class: className = '', checkInterval = 30000 }: Props = $props();

	// Degradation state types
	type DegradedReason = {
		message: string;
		icon: 'offline' | 'daemon' | 'watcher' | 'info';
		priority: number;
	};

	// Degradation tracking
	let apiDegraded = $state(false);
	let apiReason = $state<string>('');
	let isDismissed = $state(false);
	let mounted = $state(false);
	let isRetrying = $state(false);
	let checkTimer: ReturnType<typeof setInterval> | null = null;

	// Derived: Browser offline takes highest priority
	const isOffline = $derived(networkState.isOffline);

	// Derived: Compute degraded reason with priority
	const degradedReason = $derived.by((): DegradedReason | null => {
		// Priority 1: Browser offline
		if (isOffline) {
			return {
				message: "You're offline - showing cached data",
				icon: 'offline',
				priority: 1
			};
		}

		// Priority 2: API/Daemon issues
		if (apiDegraded && apiReason) {
			if (apiReason.includes('API unavailable') || apiReason.includes('status check failed')) {
				return {
					message: 'Daemon offline - showing cached data',
					icon: 'daemon',
					priority: 2
				};
			}

			// Priority 3: Service degradation (witness/refinery missing)
			if (apiReason.includes('witness') || apiReason.includes('refinery')) {
				return {
					message: `Live updates unavailable - ${apiReason}`,
					icon: 'watcher',
					priority: 3
				};
			}

			// Priority 4: Other issues
			return {
				message: apiReason,
				icon: 'info',
				priority: 4
			};
		}

		return null;
	});

	// Derived: Show banner if degraded and not dismissed
	const showBanner = $derived(mounted && degradedReason !== null && !isDismissed);

	/**
	 * Check system status via snapshot API
	 */
	async function checkSystemStatus() {
		// Skip API check if offline
		if (networkState.isOffline) {
			return;
		}

		try {
			const response = await fetch('/api/gastown/snapshot', {
				signal: AbortSignal.timeout(5000)
			});

			if (!response.ok) {
				apiReason = 'API unavailable';
				apiDegraded = true;
				return;
			}

			const data = await response.json();
			const services: string[] = [];

			// Check each rig for witness/refinery
			for (const rig of data.rigs || []) {
				if (!rig.has_witness) {
					services.push(`${rig.name} witness`);
				}
				if (!rig.has_refinery) {
					services.push(`${rig.name} refinery`);
				}
			}

			// Check for idle polecats (no active work across all rigs)
			const hasActiveWork = (data.polecats || []).some((p: any) => p.has_work);
			if (!hasActiveWork && data.polecats?.length > 0) {
				services.push('no active work');
			}

			// Update state
			if (services.length > 0) {
				apiReason = services.join(', ');
				apiDegraded = true;
			} else {
				apiReason = '';
				apiDegraded = false;
				// Reset dismissal if system recovered
				isDismissed = false;
			}
		} catch (error) {
			console.error('Failed to check system status:', error);
			apiReason = 'status check failed';
			apiDegraded = true;
		}
	}

	function handleDismiss() {
		isDismissed = true;
	}

	async function handleRetry() {
		isRetrying = true;
		// Re-check status first
		await checkSystemStatus();
		// If still degraded, reload the page
		if (degradedReason) {
			location.reload();
		}
		isRetrying = false;
	}

	// Reset dismissal when network status changes
	$effect(() => {
		if (isOffline) {
			isDismissed = false;
		}
	});

	onMount(() => {
		mounted = true;

		// Initial check
		checkSystemStatus();

		// Periodic checks
		checkTimer = setInterval(checkSystemStatus, checkInterval);

		return () => {
			if (checkTimer) {
				clearInterval(checkTimer);
			}
		};
	});
</script>

<!--
	Degraded Mode Banner Component

	Displays a banner at the top of the page when Gas Town is in degraded mode.

	Degraded States (in priority order):
	1. Network offline (📴 WifiOff) - Browser offline
	2. Daemon unreachable (⚠️ AlertTriangle) - API unavailable
	3. Watchers failed (📡 Radio) - Missing witness/refinery
	4. Other issues (ℹ️ Info) - General degradation

	Features:
	- Integrates with networkState for browser online/offline detection
	- Auto-checks system status every 30s (when online)
	- Retry button to reload page
	- Dismissible (resets when network state changes)
	- Accessible (role="alert", aria-live, aria-atomic)
	- Animated entrance
	- Auto-hides when condition resolves
-->

{#if showBanner && degradedReason}
	<div
		class={cn(
			'fixed top-0 left-0 right-0 z-40',
			'bg-warning/10 border-b border-warning/30',
			'animate-blur-fade-down',
			className
		)}
		role="alert"
		aria-live="polite"
		aria-atomic="true"
	>
		<div class="container mx-auto px-4 py-3">
			<div class="flex items-center gap-3">
				<!-- Status icon - varies by degraded state -->
				{#if degradedReason.icon === 'offline'}
					<WifiOff class="w-5 h-5 text-warning shrink-0" aria-hidden="true" />
				{:else if degradedReason.icon === 'daemon'}
					<AlertTriangle class="w-5 h-5 text-warning shrink-0" aria-hidden="true" />
				{:else if degradedReason.icon === 'watcher'}
					<Radio class="w-5 h-5 text-warning shrink-0" aria-hidden="true" />
				{:else}
					<Info class="w-5 h-5 text-warning shrink-0" aria-hidden="true" />
				{/if}

				<!-- Message -->
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-foreground">
						{degradedReason.message}
					</p>
				</div>

				<!-- Retry button -->
				<button
					type="button"
					onclick={handleRetry}
					disabled={isRetrying}
					class={cn(
						'inline-flex items-center gap-1.5 px-3 py-1.5',
						'text-xs font-medium',
						'bg-warning/20 hover:bg-warning/30',
						'text-warning-foreground',
						'rounded-md',
						'transition-colors',
						'focus-ring',
						'disabled:opacity-50 disabled:cursor-not-allowed'
					)}
					aria-label="Retry connection"
				>
					<RefreshCw
						class={cn('w-3.5 h-3.5', isRetrying && 'animate-spin')}
						aria-hidden="true"
					/>
					<span>Retry</span>
				</button>

				<!-- Dismiss button -->
				<button
					type="button"
					onclick={handleDismiss}
					class={cn(
						'p-1 -m-1',
						'text-muted-foreground hover:text-foreground',
						'transition-colors',
						'rounded',
						'focus-ring'
					)}
					aria-label="Dismiss degraded mode banner"
				>
					<X class="w-4 h-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	</div>
{/if}
