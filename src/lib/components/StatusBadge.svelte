<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	/**
	 * StatusBadge - A badge-style status indicator with icons and glow effects
	 *
	 * States: running, idle, error, warning, complete, processing, paused
	 * Features: Animated icons, glow effects, accessible labels
	 */
	export const statusBadgeVariants = tv({
		base: [
			'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
			'text-xs font-medium',
			'border transition-all duration-200'
		],
		variants: {
			status: {
				running: [
					'bg-status-online/10 text-status-online border-status-online/30',
					'shadow-[0_0_12px_-3px_hsl(var(--status-online)/0.5)]'
				],
				idle: [
					'bg-status-idle/10 text-status-idle border-status-idle/30'
				],
				error: [
					'bg-status-offline/10 text-status-offline border-status-offline/30',
					'shadow-[0_0_12px_-3px_hsl(var(--status-offline)/0.5)]'
				],
				warning: [
					'bg-status-pending/10 text-status-pending border-status-pending/30',
					'shadow-[0_0_12px_-3px_hsl(var(--status-pending)/0.4)]'
				],
				complete: [
					'bg-success/10 text-success border-success/30',
					'shadow-[0_0_12px_-3px_hsl(var(--success)/0.5)]'
				],
				processing: [
					'bg-info/10 text-info border-info/30',
					'shadow-[0_0_12px_-3px_hsl(var(--info)/0.4)]'
				],
				paused: [
					'bg-muted text-muted-foreground border-border'
				]
			},
			size: {
				sm: 'text-2xs px-2 py-0.5',
				md: 'text-xs px-2.5 py-1',
				lg: 'text-sm px-3 py-1.5'
			},
			glow: {
				true: '',
				false: 'shadow-none'
			}
		},
		compoundVariants: [
			// Enhanced glow for running state
			{ status: 'running', glow: true, class: 'animate-pulse' }
		],
		defaultVariants: {
			status: 'idle',
			size: 'md',
			glow: true
		}
	});

	export type StatusBadgeVariants = VariantProps<typeof statusBadgeVariants>;

	export interface StatusBadgeProps {
		status?: StatusBadgeVariants['status'];
		size?: StatusBadgeVariants['size'];
		glow?: boolean;
		label?: string;
		showIcon?: boolean;
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props extends StatusBadgeProps {
		class?: string;
	}

	let {
		status = 'idle',
		size = 'md',
		glow = true,
		label,
		showIcon = true,
		class: className = ''
	}: Props = $props();

	// Default labels for each status
	const defaultLabels: Record<string, string> = {
		running: 'Running',
		idle: 'Idle',
		error: 'Error',
		warning: 'Warning',
		complete: 'Complete',
		processing: 'Processing',
		paused: 'Paused'
	};

	const displayLabel = $derived(label ?? defaultLabels[status ?? 'idle']);

	// Icon sizes based on badge size
	const iconSize = $derived({
		sm: 'w-3 h-3',
		md: 'w-3.5 h-3.5',
		lg: 'w-4 h-4'
	}[size ?? 'md']);
</script>

<span
	class={cn(statusBadgeVariants({ status, size, glow }), className)}
	role="status"
	aria-label={displayLabel}
>
	{#if showIcon}
		<span class={cn('flex-shrink-0', iconSize)} aria-hidden="true">
			{#if status === 'running'}
				<!-- Pulse dot -->
				<span class="block w-full h-full rounded-full bg-current animate-pulse"></span>
			{:else if status === 'processing'}
				<!-- Spinning loader -->
				<svg class="animate-spin" viewBox="0 0 24 24" fill="none">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="3"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			{:else if status === 'complete'}
				<!-- Checkmark -->
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			{:else if status === 'error'}
				<!-- X mark -->
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			{:else if status === 'warning'}
				<!-- Warning triangle -->
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
					<line x1="12" y1="9" x2="12" y2="13" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			{:else if status === 'paused'}
				<!-- Pause icon -->
				<svg viewBox="0 0 24 24" fill="currentColor">
					<rect x="6" y="4" width="4" height="16" rx="1" />
					<rect x="14" y="4" width="4" height="16" rx="1" />
				</svg>
			{:else}
				<!-- Idle dot -->
				<span class="block w-full h-full rounded-full bg-current opacity-50"></span>
			{/if}
		</span>
	{/if}
	<span>{displayLabel}</span>
</span>
