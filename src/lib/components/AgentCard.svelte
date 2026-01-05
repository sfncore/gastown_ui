<script context="module" lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';

	/**
	 * AgentCard variant definitions using tailwind-variants
	 */
	export const agentCardVariants = tv({
		base: 'panel-glass p-4 space-y-3 transition-all duration-200 hover:shadow-lg hover:border-accent/50',
		variants: {
			status: {
				running: 'border-status-online/30',
				idle: 'border-status-idle/30',
				error: 'border-status-offline/30 animate-shake',
				complete: 'border-status-online/30'
			}
		},
		defaultVariants: {
			status: 'idle'
		}
	});

	/**
	 * Props type derived from variant definitions
	 */
	export type AgentCardProps = VariantProps<typeof agentCardVariants> & {
		name: string;
		task?: string;
		meta?: string;
		progress?: number;
		class?: string;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import StatusIndicator from './StatusIndicator.svelte';
	import ProgressBar from './ProgressBar.svelte';

	// Component props
	let {
		name,
		status = 'idle',
		task = '',
		meta = '',
		progress = 0,
		class: className = ''
	}: AgentCardProps = $props();

	// Map status to StatusIndicator status type
	const statusIndicatorMap = {
		running: 'running',
		idle: 'idle',
		error: 'error',
		complete: 'complete'
	} as const;

	// Map status to ProgressBar color
	const progressColorMap = {
		running: 'default',
		idle: 'default',
		error: 'error',
		complete: 'success'
	} as const;
</script>

<article class={cn(agentCardVariants({ status }), className)}>
	<!-- Header: Name + Status -->
	<header class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-2 min-w-0">
			<StatusIndicator status={statusIndicatorMap[status ?? 'idle']} size="md" />
			<h3 class="font-medium text-foreground truncate">{name}</h3>
		</div>
		{#if $$slots.actions}
			<div class="flex items-center gap-1 flex-shrink-0">
				<slot name="actions" />
			</div>
		{/if}
	</header>

	<!-- Body: Task + Meta -->
	{#if task || meta}
		<div class="space-y-1">
			{#if task}
				<p class="text-sm text-foreground/80 line-clamp-2">{task}</p>
			{/if}
			{#if meta}
				<p class="text-xs text-muted-foreground">{meta}</p>
			{/if}
		</div>
	{/if}

	<!-- Footer: Progress -->
	{#if status === 'running' && progress > 0}
		<footer class="pt-1">
			<ProgressBar
				value={progress}
				size="sm"
				color={progressColorMap[status ?? 'idle']}
			/>
		</footer>
	{/if}

	<!-- Custom content slot -->
	{#if $$slots.default}
		<div class="pt-2 border-t border-border/50">
			<slot />
		</div>
	{/if}
</article>
