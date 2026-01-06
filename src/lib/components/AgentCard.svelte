<script module lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';

	/**
	 * AgentCard variant definitions using tailwind-variants
	 * Enhanced for mobile with rich interactions and expandable details
	 */
	export const agentCardVariants = tv({
		slots: {
			card: 'panel-glass transition-all duration-200 hover:shadow-lg hover:border-accent/50 overflow-hidden',
			hero: 'flex items-center justify-center p-4 bg-gradient-to-br',
			heroIcon: 'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md',
			content: 'p-4 space-y-3',
			header: 'flex items-center justify-between gap-3',
			badge: 'px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide',
			details: 'overflow-hidden transition-all duration-300 ease-out',
			actions: 'flex gap-2 pt-3 border-t border-border/50',
			actionBtn: 'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 min-h-[44px]'
		},
		variants: {
			status: {
				running: {
					card: 'border-status-online/30',
					hero: 'from-status-online/10 to-status-online/5',
					heroIcon: 'bg-status-online/20 text-status-online',
					badge: 'bg-status-online/15 text-status-online'
				},
				idle: {
					card: 'border-status-idle/30',
					hero: 'from-status-idle/10 to-status-idle/5',
					heroIcon: 'bg-status-idle/20 text-status-idle',
					badge: 'bg-status-idle/15 text-status-idle'
				},
				error: {
					card: 'border-status-offline/50 shadow-[0_0_20px_-5px_hsl(var(--status-offline)/0.3)] animate-shake',
					hero: 'from-status-offline/15 to-status-offline/5',
					heroIcon: 'bg-status-offline/25 text-status-offline animate-pulse',
					badge: 'bg-status-offline/20 text-status-offline animate-pulse'
				},
				complete: {
					card: 'border-status-online/30',
					hero: 'from-status-online/10 to-status-online/5',
					heroIcon: 'bg-status-online/20 text-status-online',
					badge: 'bg-status-online/15 text-status-online'
				}
			},
			expanded: {
				true: { details: 'max-h-96 opacity-100' },
				false: { details: 'max-h-0 opacity-0' }
			},
			compact: {
				true: { hero: 'hidden', content: 'p-3' },
				false: {}
			}
		},
		defaultVariants: {
			status: 'idle',
			expanded: false,
			compact: false
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
		// Mobile-rich props
		uptime?: string;
		errorMessage?: string;
		expandable?: boolean;
		onInspect?: () => void;
		onReboot?: () => void;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import StatusIndicator from './StatusIndicator.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import type { Snippet } from 'svelte';
	import {
		ChevronDown,
		ClipboardList,
		Clock,
		AlertTriangle,
		Search,
		RefreshCw,
		// Status icons (replacing emojis)
		Zap,
		Moon,
		AlertCircle,
		CheckCircle2
	} from 'lucide-svelte';

	// Component props with slot snippets
	interface Props extends Omit<AgentCardProps, 'expanded'> {
		expanded?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	}

	let {
		name,
		status = 'idle',
		task = '',
		meta = '',
		progress = 0,
		class: className = '',
		// Mobile-rich props
		uptime = '',
		errorMessage = '',
		expandable = false,
		compact = false,
		onInspect,
		onReboot,
		// Slot snippets
		expanded: expandedSlot,
		actions: actionsSlot,
		children
	}: Props = $props();

	// Expandable state
	let isExpanded = $state(false);

	// Derived styles
	const styles = $derived(agentCardVariants({ status, expanded: isExpanded, compact }));

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

	// Status label mapping
	const statusLabels = {
		running: 'Running',
		idle: 'Idle',
		error: 'Error',
		complete: 'Complete'
	} as const;

	// Default Lucide icons by status (replacing emojis)
	const statusIcons = {
		running: Zap,
		idle: Moon,
		error: AlertCircle,
		complete: CheckCircle2
	} as const;

	// Get the icon component for current status
	const StatusIcon = $derived(statusIcons[status ?? 'idle']);

	// Toggle expanded state
	function toggleExpanded() {
		if (expandable) {
			isExpanded = !isExpanded;
		}
	}

	// Handle keyboard for expansion
	function handleKeyDown(e: KeyboardEvent) {
		if (expandable && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			toggleExpanded();
		}
	}
</script>

<article
	class={cn(styles.card(), className)}
	role={expandable ? 'button' : undefined}
	tabindex={expandable ? 0 : undefined}
	aria-expanded={expandable ? isExpanded : undefined}
	onclick={expandable ? toggleExpanded : undefined}
	onkeydown={expandable ? handleKeyDown : undefined}
>
	<!-- Hero Section with Lucide Icon -->
	{#if !compact}
		<div class={styles.hero()}>
			<div class={styles.heroIcon()}>
				<StatusIcon class="w-7 h-7" strokeWidth={2} />
			</div>
		</div>
	{/if}

	<div class={styles.content()}>
		<!-- Header: Name + Status Badge -->
		<header class={styles.header()}>
			<div class="flex items-center gap-2 min-w-0">
				<StatusIndicator status={statusIndicatorMap[status ?? 'idle']} size="md" />
				<h3 class="font-medium text-foreground truncate">{name}</h3>
			</div>
			<div class="flex items-center gap-2 flex-shrink-0">
				<span class={styles.badge()}>
					{statusLabels[status ?? 'idle']}
				</span>
				{#if expandable}
					<ChevronDown
						class="w-4 h-4 text-muted-foreground transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
						aria-hidden="true"
					/>
				{/if}
			</div>
		</header>

		<!-- Body: Task + Metadata -->
		{#if task || meta || uptime}
			<div class="space-y-2">
				{#if task}
					<p class="text-sm text-foreground/80 line-clamp-2">{task}</p>
				{/if}
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
					{#if meta}
						<span class="flex items-center gap-1">
							<ClipboardList class="w-3.5 h-3.5" />
							{meta}
						</span>
					{/if}
					{#if uptime}
						<span class="flex items-center gap-1">
							<Clock class="w-3.5 h-3.5" />
							{uptime}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Error Message (prominent for error state) -->
		{#if status === 'error' && errorMessage}
			<div class="p-3 rounded-lg bg-status-offline/10 border border-status-offline/20">
				<p class="text-sm text-status-offline font-medium flex items-start gap-2">
					<AlertTriangle class="w-4 h-4 flex-shrink-0 mt-0.5" />
					{errorMessage}
				</p>
			</div>
		{/if}

		<!-- Progress Bar -->
		{#if status === 'running' && progress > 0}
			<div class="pt-1">
				<ProgressBar
					value={progress}
					size="sm"
					color={progressColorMap[status ?? 'idle']}
				/>
			</div>
		{/if}

		<!-- Expandable Details Section -->
		{#if expandable}
			<div class={styles.details()}>
				{#if isExpanded}
					<!-- Quick Actions -->
					{#if onInspect || onReboot}
						<div class={styles.actions()}>
							{#if onInspect}
								<button
									type="button"
									class={cn(styles.actionBtn(), 'bg-secondary hover:bg-secondary/80 text-secondary-foreground')}
									onclick={(e) => { e.stopPropagation(); onInspect?.(); }}
								>
									<Search class="w-4 h-4" />
									Inspect
								</button>
							{/if}
							{#if onReboot}
								<button
									type="button"
									class={cn(
										styles.actionBtn(),
										status === 'error'
											? 'bg-status-offline/15 hover:bg-status-offline/25 text-status-offline'
											: 'bg-primary/10 hover:bg-primary/20 text-primary'
									)}
									onclick={(e) => { e.stopPropagation(); onReboot?.(); }}
								>
									<RefreshCw class="w-4 h-4" />
									Reboot
								</button>
							{/if}
						</div>
					{/if}

					<!-- Custom expanded content -->
					{#if expandedSlot}
						<div class="pt-3">
							{@render expandedSlot()}
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Legacy actions (non-expandable cards) -->
		{#if !expandable && actionsSlot}
			<div class="flex items-center gap-1 pt-2">
				{@render actionsSlot()}
			</div>
		{/if}
	</div>

	<!-- Custom content -->
	{#if children}
		<div class="px-4 pb-4 pt-2 border-t border-border/50">
			{@render children()}
		</div>
	{/if}
</article>
