<script lang="ts">
	import { cn } from '$lib/utils';
	import { AgentCard, StatsCard, EmptyState, Button, CircularProgress, GridPattern, PageHeader } from '$lib/components';
	import { Clock, CheckCircle, Zap, Layers, TrendingUp, Package } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	function navigate(path: string) {
		if (browser) {
			goto(path);
		}
	}

	type AgentRole = 'coordinator' | 'health-check' | 'witness' | 'refinery' | 'crew' | undefined;

	function mapAgentRole(role: string): AgentRole {
		const roleMap: Record<string, AgentRole> = {
			'polecat': 'crew',
			'mayor': 'coordinator',
			'deacon': 'health-check',
			'witness': 'witness',
			'refinery': 'refinery',
			'crew': 'crew'
		};
		return roleMap[role] ?? undefined;
	}

	interface DashboardAgent {
		id: string;
		name: string;
		task: string;
		status: 'running' | 'idle' | 'error' | 'complete';
		progress: number;
		meta: string;
		role: string;
		address: string;
	}

	interface DashboardStats {
		activeAgents: number;
		tasksRunning: number;
		queueDepth: number;
		completedToday: number;
	}

	interface Workflow {
		id: string;
		name: string;
		status: 'running' | 'pending' | 'completed';
		progress: number;
	}

	interface QueueItem {
		id: string;
		task: string;
		priority: 'high' | 'medium' | 'low';
	}

	interface LogEntry {
		id: string;
		message: string;
		time: string;
		level: 'info' | 'success' | 'warning' | 'error';
	}

	interface Props {
		title?: string;
		agents: DashboardAgent[];
		stats: DashboardStats;
		systemStatus?: 'running' | 'idle' | 'error' | 'warning';
		error?: string | null;
		workflows?: Workflow[];
		queueItems?: QueueItem[];
		logEntries?: LogEntry[];
		class?: string;
	}

	let {
		title = 'GASTOWN',
		agents,
		stats,
		systemStatus = 'running',
		error = null,
		workflows = [
			{ id: '1', name: 'Deploy Pipeline', status: 'running', progress: 65 },
			{ id: '2', name: 'Test Suite', status: 'pending', progress: 0 },
			{ id: '3', name: 'Build Assets', status: 'completed', progress: 100 }
		],
		queueItems = [
			{ id: '1', task: 'Process batch #1234', priority: 'high' },
			{ id: '2', task: 'Sync database', priority: 'medium' },
			{ id: '3', task: 'Generate reports', priority: 'low' }
		],
		logEntries = [
			{ id: '1', message: 'Agent nux completed task', time: '2m ago', level: 'info' },
			{ id: '2', message: 'Workflow deploy started', time: '5m ago', level: 'info' },
			{ id: '3', message: 'Queue item processed', time: '8m ago', level: 'success' },
			{ id: '4', message: 'Agent furiosa restarted', time: '12m ago', level: 'warning' }
		],
		class: className = ''
	}: Props = $props();
</script>

<div class={cn('relative min-h-screen bg-background', className)}>
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10 flex flex-col min-h-screen">
		<PageHeader
			{title}
			showAccentBar={true}
			liveCount={{
				count: systemStatus === 'running' ? 1 : 0,
				label: systemStatus === 'running' ? 'connected' : systemStatus === 'error' ? 'disconnected' : systemStatus,
				status: systemStatus === 'running' ? 'success' : systemStatus === 'error' ? 'error' : 'warning'
			}}
		>
			{#snippet actions()}
				<div class="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
					<span
						class="w-2 h-2 rounded-full {systemStatus === 'running' ? 'bg-primary animate-pulse' : systemStatus === 'error' ? 'bg-destructive' : 'bg-warning'}"
						aria-hidden="true"
					></span>
					<span class="text-[10px] font-bold uppercase tracking-wider {systemStatus === 'running' ? 'text-primary' : systemStatus === 'error' ? 'text-destructive' : 'text-warning'}">
						{systemStatus === 'running' ? 'Connected' : systemStatus === 'error' ? 'Disconnected' : systemStatus}
					</span>
				</div>
			{/snippet}
		</PageHeader>

		<main class="flex-1 container py-6 space-y-6">
			<div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
				<!-- Left Column: Agents -->
				<section class="xl:col-span-4 space-y-4" aria-labelledby="agents-heading">
					<h2 id="agents-heading" class="text-lg font-semibold text-foreground">Agents</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
						{#if error}
							<EmptyState
								preset="error"
								title="Failed to load agents"
								description={error}
								actionLabel="Retry"
								size="sm"
							/>
						{:else if agents.length === 0}
							<EmptyState
								preset="no-data"
								title="No agents running"
								description="Start an agent to see it here"
								size="sm"
							/>
						{:else}
							{#each agents as agent (agent.id)}
								<AgentCard
									name={agent.name}
									task={agent.task}
									status={agent.status}
									progress={agent.progress}
									meta={agent.meta}
									role={mapAgentRole(agent.role)}
									compact
								/>
							{/each}
						{/if}
					</div>
				</section>

				<!-- Center Column: Workflows + Queue -->
				<section class="xl:col-span-5 space-y-6">
					<div class="space-y-4" aria-labelledby="workflows-heading">
						<h2 id="workflows-heading" class="text-lg font-semibold text-foreground">Workflows</h2>
						<div class="panel-glass divide-y divide-border overflow-hidden rounded-lg">
							{#each workflows as workflow (workflow.id)}
								<div 
									class="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors cursor-pointer group"
									role="button"
									tabindex="0"
									onclick={() => navigate(`/workflows/${workflow.id}`)}
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/workflows/${workflow.id}`)}
									aria-label="View {workflow.name} workflow"
								>
									<div class="flex items-center gap-3 min-w-0 flex-1">
										<span class="text-sm font-medium text-foreground truncate">{workflow.name}</span>
									</div>
									
									<div class="flex items-center gap-3 flex-shrink-0">
										<div class="text-right">
											{#if workflow.status === 'running'}
												<span class="text-xs text-muted-foreground block">{workflow.progress}%</span>
												<span class="text-xs text-muted-foreground/70">Running</span>
											{:else if workflow.status === 'completed'}
												<span class="text-xs text-success block">Complete</span>
											{:else}
												<span class="text-xs text-warning block">Pending</span>
											{/if}
										</div>
										
										<CircularProgress 
											progress={workflow.progress}
											diameter={32}
											status={workflow.status as 'pending' | 'running' | 'completed'}
											icon={workflow.status === 'pending' ? Clock : workflow.status === 'completed' ? CheckCircle : undefined}
											ariaLabel="{workflow.name} progress: {workflow.progress}%"
										/>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="space-y-4" aria-labelledby="queue-heading">
						<h2 id="queue-heading" class="text-lg font-semibold text-foreground">Queue</h2>
						<div class="panel-glass divide-y divide-border overflow-hidden rounded-lg">
							{#each queueItems as item (item.id)}
								<div class="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
									<span class="text-sm text-foreground truncate">{item.task}</span>
									<span
										class="text-2xs font-bold uppercase px-2 py-0.5 rounded {item.priority === 'high' ? 'bg-destructive/20 text-destructive' : item.priority === 'medium' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}"
									>
										{item.priority}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</section>

				<!-- Right Column: Stats + Actions -->
				<section class="xl:col-span-3 space-y-6">
					<div class="space-y-4" aria-labelledby="stats-heading">
						<h2 id="stats-heading" class="text-lg font-semibold text-foreground">System Stats</h2>
						<div class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-none xl:grid xl:grid-cols-1 xl:overflow-visible xl:snap-none xl:mx-0 xl:px-0">
							<button
								type="button"
								onclick={() => navigate('/agents')}
								class="w-full text-left hover:opacity-100 transition-opacity"
							>
								<StatsCard
									label="Active Agents"
									value={stats.activeAgents}
									icon={Zap}
									trend="up"
									trendValue={12}
									comparisonText="from yesterday"
									sparklineData={[3, 4, 3, 5, 4, 6, stats.activeAgents]}
								/>
							</button>
							<button
								type="button"
								onclick={() => navigate('/work')}
								class="w-full text-left hover:opacity-100 transition-opacity"
							>
								<StatsCard
									label="Tasks Running"
									value={stats.tasksRunning}
									icon={Layers}
									trend="neutral"
								/>
							</button>
							<button
								type="button"
								onclick={() => navigate('/queue')}
								class="w-full text-left hover:opacity-100 transition-opacity"
							>
								<StatsCard
									label="Polecats"
									value={stats.queueDepth}
									icon={Package}
									trend={stats.queueDepth > 5 ? 'up' : 'down'}
									trendValue={stats.queueDepth > 5 ? 8 : -3}
								/>
							</button>
							<button
								type="button"
								onclick={() => navigate('/activity')}
								class="w-full text-left hover:opacity-100 transition-opacity"
							>
								<StatsCard
									label="Completed Today"
									value={stats.completedToday}
									icon={TrendingUp}
									trend="up"
									trendValue={25}
									comparisonText="from yesterday"
								/>
							</button>
						</div>
					</div>

					<div class="space-y-4" aria-labelledby="actions-heading">
						<h2 id="actions-heading" class="text-lg font-semibold text-foreground">Quick Actions</h2>
						<div class="flex flex-col gap-2">
							<Button variant="primary" fullWidth>
								Create Agent
							</Button>
							<Button variant="ghost" fullWidth>
								View All Logs
							</Button>
							<Button variant="ghost" fullWidth>
								System Settings
							</Button>
						</div>
					</div>
				</section>
			</div>

			<!-- Bottom: Full-width Logs -->
			<section class="space-y-4" aria-labelledby="logs-heading">
				<h2 id="logs-heading" class="text-lg font-semibold text-foreground">Activity Logs</h2>
				<div class="panel-glass divide-y divide-border overflow-hidden rounded-lg max-h-80 overflow-y-auto">
					{#each logEntries as log (log.id)}
						<div class="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
							<div class="flex items-center gap-3 min-w-0">
								<span
									class="w-1.5 h-1.5 rounded-full {log.level === 'success' ? 'bg-success' : log.level === 'warning' ? 'bg-warning' : log.level === 'error' ? 'bg-destructive' : 'bg-info'}"
									aria-hidden="true"
								></span>
								<span class="text-sm text-foreground truncate">{log.message}</span>
							</div>
							<span class="text-xs text-muted-foreground flex-shrink-0">{log.time}</span>
						</div>
					{/each}
				</div>
			</section>
		</main>
	</div>
</div>

<style>
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
</style>
