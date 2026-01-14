<script lang="ts">
	import { cn } from '$lib/utils';

	export interface ActivityEvent {
		id: string;
		timestamp: string;
		type: string;
		actor: string;
		actorDisplay?: string;
		description: string;
		payload?: Record<string, unknown>;
		icon?: string;
	}

	interface Props {
		events: ActivityEvent[];
		/** Maximum number of events to display */
		limit?: number;
		/** Show date headers */
		showDateHeaders?: boolean;
		/** Show full timestamps or just time */
		showFullTimestamp?: boolean;
		/** Compact mode (smaller padding and text) */
		compact?: boolean;
		/** Custom empty state message */
		emptyMessage?: string;
		/** Custom class for the container */
		class?: string;
	}

	let {
		events,
		limit,
		showDateHeaders = true,
		showFullTimestamp = false,
		compact = false,
		emptyMessage = 'No activity yet',
		class: className
	}: Props = $props();

	// Icon SVG paths
	const iconSvgs: Record<string, string> = {
		play: '<path d="M6 4l12 8-12 8V4z"/>',
		stop: '<rect x="6" y="6" width="12" height="12"/>',
		rocket:
			'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
		bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
		send: '<path d="M22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
		inbox:
			'<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
		'play-circle': '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
		'check-circle':
			'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
		'git-merge':
			'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
		check: '<polyline points="20 6 9 17 4 12"/>',
		x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
		'alert-triangle':
			'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
		activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
		package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
		user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
		users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
	};

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		if (showFullTimestamp) {
			return date.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		}
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		}
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getEventColor(type: string): string {
		const colors: Record<string, string> = {
			session_start: 'text-success',
			session_end: 'text-muted-foreground',
			spawn: 'text-accent',
			nudge: 'text-warning',
			mail_sent: 'text-info',
			mail_received: 'text-info',
			work_started: 'text-accent',
			work_completed: 'text-success',
			merge: 'text-success',
			test_pass: 'text-success',
			test_fail: 'text-destructive',
			error: 'text-destructive',
			convoy_created: 'text-primary',
			convoy_completed: 'text-success',
			issue_created: 'text-info',
			issue_closed: 'text-success'
		};
		return colors[type] || 'text-foreground';
	}

	function groupByDate(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
		const groups = new Map<string, ActivityEvent[]>();
		for (const event of events) {
			const dateKey = formatDate(event.timestamp);
			if (!groups.has(dateKey)) {
				groups.set(dateKey, []);
			}
			groups.get(dateKey)!.push(event);
		}
		return groups;
	}

	const limitedEvents = $derived(limit ? events.slice(0, limit) : events);
	const groupedEvents = $derived(
		showDateHeaders ? groupByDate(limitedEvents) : new Map([['', limitedEvents]])
	);
</script>

{#if limitedEvents.length === 0}
	<div class={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
		<svg
			class="w-12 h-12 text-muted-foreground mb-3"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{@html iconSvgs.activity}
		</svg>
		<p class="text-sm text-muted-foreground">{emptyMessage}</p>
	</div>
{:else}
	<div class={cn('space-y-4', className)}>
		{#each groupedEvents as [date, events]}
			<div>
				{#if showDateHeaders && date}
					<!-- Date header -->
					<div class="flex items-center gap-3 mb-2">
						<span
							class={cn(
								'text-xs font-medium text-muted-foreground uppercase tracking-wide',
								compact && 'text-2xs'
							)}
						>
							{date}
						</span>
						<div class="flex-1 h-px bg-border"></div>
					</div>
				{/if}

				<!-- Events for this date/group -->
				<div class="space-y-1">
					{#each events as event, i}
						<div
							class={cn(
								'flex items-start gap-3 rounded-lg transition-colors hover:bg-muted/30',
								compact ? 'p-2' : 'p-3'
							)}
						>
							<!-- Icon -->
							<div
								class={cn(
									'flex-shrink-0 rounded-full flex items-center justify-center bg-muted/50',
									compact ? 'w-6 h-6' : 'w-8 h-8',
									getEventColor(event.type)
								)}
							>
								<svg
									class={cn('', compact ? 'w-3 h-3' : 'w-4 h-4')}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									{@html iconSvgs[event.icon || 'activity']}
								</svg>
							</div>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5 flex-wrap">
									{#if event.actorDisplay || event.actor}
										<span class={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
											{event.actorDisplay || event.actor}
										</span>
									{/if}
									<span
										class={cn(
											'px-1.5 py-0.5 font-mono bg-muted rounded text-muted-foreground',
											compact ? 'text-3xs' : 'text-2xs'
										)}
									>
										{event.type.replace(/_/g, ' ')}
									</span>
								</div>
								<p class={cn('text-muted-foreground break-words', compact ? 'text-xs' : 'text-sm')}>
									{event.description}
								</p>
							</div>

							<!-- Timestamp -->
							<time
								class={cn(
									'flex-shrink-0 text-muted-foreground font-mono',
									compact ? 'text-2xs' : 'text-xs'
								)}
							>
								{formatTime(event.timestamp)}
							</time>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
