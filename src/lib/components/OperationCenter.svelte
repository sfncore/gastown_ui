<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button, StatusIndicator, CircularProgress } from '$lib/components';
	import {
		Play,
		Pause,
		Square,
		RefreshCw,
		AlertTriangle,
		CheckCircle2,
		Clock,
		Zap,
		Package,
		Users,
		Activity
	} from 'lucide-svelte';

	interface OperationStatus {
		id: string;
		name: string;
		type: 'workflow' | 'convoy' | 'task';
		status: 'running' | 'paused' | 'pending' | 'completed' | 'error';
		progress: number;
		startedAt: string;
		estimatedCompletion?: string;
	}

	interface QuickAction {
		id: string;
		label: string;
		icon: any;
		variant: 'primary' | 'secondary' | 'destructive';
		action: () => void;
		disabled?: boolean;
	}

	interface SystemMetric {
		label: string;
		value: string | number;
		status: 'success' | 'warning' | 'error' | 'neutral';
		icon?: any;
	}

	interface ActivityItem {
		id: string;
		message: string;
		timestamp: string;
		level: 'info' | 'success' | 'warning' | 'error';
	}

	interface Props {
		/** Active operations currently running */
		operations?: OperationStatus[];
		/** System health metrics */
		metrics?: SystemMetric[];
		/** Recent activity feed */
		activities?: ActivityItem[];
		/** Quick action buttons */
		actions?: QuickAction[];
		/** Overall system status */
		systemStatus?: 'healthy' | 'degraded' | 'critical';
		/** Loading state */
		loading?: boolean;
		/** Additional classes */
		class?: string;
	}

	let {
		operations = [],
		metrics = [
			{ label: 'Active Agents', value: 8, status: 'success', icon: Users },
			{ label: 'Queue Depth', value: 12, status: 'neutral', icon: Package },
			{ label: 'Operations', value: 3, status: 'success', icon: Activity },
			{ label: 'Uptime', value: '99.9%', status: 'success', icon: Zap }
		],
		activities = [],
		actions = [],
		systemStatus = 'healthy',
		loading = false,
		class: className = ''
	}: Props = $props();

	// Derive status indicator from system status
	const statusIndicator = $derived.by(() => {
		switch (systemStatus) {
			case 'healthy':
				return 'complete';
			case 'degraded':
				return 'warning';
			case 'critical':
				return 'error';
			default:
				return 'idle';
		}
	});

	// Derive status message
	const statusMessage = $derived.by(() => {
		switch (systemStatus) {
			case 'healthy':
				return 'All systems operational';
			case 'degraded':
				return 'Some services degraded';
			case 'critical':
				return 'Critical issues detected';
			default:
				return 'Status unknown';
		}
	});

	// Format relative time
	function formatRelativeTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return date.toLocaleDateString();
	}

	// Get status color classes
	function getStatusColor(status: OperationStatus['status']): string {
		switch (status) {
			case 'running':
				return 'text-info';
			case 'paused':
				return 'text-warning';
			case 'pending':
				return 'text-muted-foreground';
			case 'completed':
				return 'text-success';
			case 'error':
				return 'text-destructive';
			default:
				return 'text-muted-foreground';
		}
	}

	// Get activity level color
	function getActivityColor(level: ActivityItem['level']): string {
		switch (level) {
			case 'success':
				return 'text-success';
			case 'warning':
				return 'text-warning';
			case 'error':
				return 'text-destructive';
			default:
				return 'text-muted-foreground';
		}
	}

	// Get metric status color
	function getMetricStatusColor(status: SystemMetric['status']): string {
		switch (status) {
			case 'success':
				return 'text-success';
			case 'warning':
				return 'text-warning';
			case 'error':
				return 'text-destructive';
			default:
				return 'text-muted-foreground';
		}
	}
</script>

<!--
	Operation Center Component

	Central control panel for managing and monitoring Gas Town operations.
	Provides quick actions, real-time status, and activity monitoring.
-->

<div class={cn('space-y-6', className)}>
	<!-- System Status Header -->
	<div class="panel-glass rounded-xl p-6">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-3">
				<StatusIndicator status={statusIndicator} size="lg" />
				<div>
					<h2 class="text-lg font-semibold text-foreground">Operation Center</h2>
					<p class="text-sm text-muted-foreground">{statusMessage}</p>
				</div>
			</div>

			{#if loading}
				<div class="animate-spin">
					<RefreshCw class="w-5 h-5 text-muted-foreground" />
				</div>
			{/if}
		</div>

		<!-- System Metrics Grid -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			{#each metrics as metric}
				<div class="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
					{#if metric.icon}
						{@const Icon = metric.icon}
						<Icon class={cn('w-5 h-5', getMetricStatusColor(metric.status))} />
					{/if}
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground truncate">{metric.label}</p>
						<p class={cn('text-lg font-semibold', getMetricStatusColor(metric.status))}>
							{metric.value}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Active Operations Panel -->
		<div class="panel-glass rounded-xl p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-base font-semibold text-foreground">Active Operations</h3>
				<span class="text-xs text-muted-foreground">{operations.length} running</span>
			</div>

			<div class="space-y-3">
				{#if operations.length === 0}
					<div class="text-center py-8 text-sm text-muted-foreground">
						No active operations
					</div>
				{:else}
					{#each operations as operation}
						<div class="p-3 rounded-lg bg-muted/20 border border-border/50">
							<div class="flex items-start justify-between mb-2">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-foreground truncate">
										{operation.name}
									</p>
									<p class="text-xs text-muted-foreground">
										{operation.type} • Started {formatRelativeTime(operation.startedAt)}
									</p>
								</div>
								<span class={cn('text-xs font-medium ml-2', getStatusColor(operation.status))}>
									{operation.status}
								</span>
							</div>

							<!-- Progress bar -->
							<div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
								<div
									class={cn(
										'h-full transition-all duration-300',
										operation.status === 'running'
											? 'bg-info'
											: operation.status === 'completed'
												? 'bg-success'
												: operation.status === 'error'
													? 'bg-destructive'
													: 'bg-muted-foreground'
									)}
									style="width: {operation.progress}%"
								></div>
							</div>
							<p class="text-xs text-muted-foreground mt-1">{operation.progress}% complete</p>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Quick Actions Panel -->
		<div class="panel-glass rounded-xl p-6">
			<h3 class="text-base font-semibold text-foreground mb-4">Quick Actions</h3>

			<div class="grid grid-cols-2 gap-3">
				{#if actions.length === 0}
					<div class="col-span-2 text-center py-8 text-sm text-muted-foreground">
						No actions available
					</div>
				{:else}
					{#each actions as action}
						{@const Icon = action.icon}
						<button
							type="button"
							onclick={action.action}
							disabled={action.disabled || loading}
							class={cn(
								'flex flex-col items-center gap-2 p-4 rounded-lg',
								'border border-border/50',
								'transition-all duration-150',
								'hover:border-primary/50 hover:bg-primary/5',
								'focus-ring',
								'disabled:opacity-50 disabled:cursor-not-allowed',
								action.variant === 'primary' && 'bg-primary/10 border-primary/30',
								action.variant === 'destructive' && 'bg-destructive/10 border-destructive/30'
							)}
						>
							<Icon
								class={cn(
									'w-6 h-6',
									action.variant === 'primary'
										? 'text-primary'
										: action.variant === 'destructive'
											? 'text-destructive'
											: 'text-foreground'
								)}
							/>
							<span class="text-xs font-medium text-foreground text-center">
								{action.label}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Activity Stream -->
	<div class="panel-glass rounded-xl p-6">
		<h3 class="text-base font-semibold text-foreground mb-4">Recent Activity</h3>

		<div class="space-y-2 max-h-64 overflow-y-auto">
			{#if activities.length === 0}
				<div class="text-center py-8 text-sm text-muted-foreground">No recent activity</div>
			{:else}
				{#each activities as activity}
					<div class="flex items-start gap-3 p-2 rounded hover:bg-muted/20 transition-colors">
						<div class={cn('w-2 h-2 rounded-full mt-1.5', getActivityColor(activity.level))}></div>
						<div class="flex-1 min-w-0">
							<p class="text-sm text-foreground">{activity.message}</p>
							<p class="text-xs text-muted-foreground">{formatRelativeTime(activity.timestamp)}</p>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
