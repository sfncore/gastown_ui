<script lang="ts">
	import { tv } from 'tailwind-variants';
	import { GridPattern } from '$lib/components';
	import { cn } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Track which message is expanded
	let expandedId = $state<string | null>(null);

	/**
	 * Message type badge variants
	 */
	const typeBadgeVariants = tv({
		base: 'inline-flex items-center px-2 py-0.5 text-2xs font-mono font-bold rounded uppercase',
		variants: {
			type: {
				ESCALATION: 'bg-destructive/20 text-destructive',
				ERROR: 'bg-destructive/20 text-destructive',
				HANDOFF: 'bg-warning/20 text-warning',
				DONE: 'bg-success/20 text-success',
				POLECAT_DONE: 'bg-success/20 text-success',
				TEST: 'bg-info/20 text-info',
				MESSAGE: 'bg-muted text-muted-foreground'
			}
		},
		defaultVariants: {
			type: 'MESSAGE'
		}
	});

	/**
	 * Format timestamp for display
	 */
	function formatTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		// Less than 1 hour: show minutes
		if (diff < 3600000) {
			const mins = Math.floor(diff / 60000);
			return mins <= 0 ? 'now' : `${mins}m ago`;
		}

		// Less than 24 hours: show hours
		if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}h ago`;
		}

		// Otherwise: show date
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Format sender address for display
	 */
	function formatSender(from: string): string {
		// Extract the agent name from address like "gastown_ui/polecats/nux"
		const parts = from.split('/');
		if (parts.length === 0) return from;

		const last = parts[parts.length - 1];
		// Capitalize first letter
		return last.charAt(0).toUpperCase() + last.slice(1);
	}

	/**
	 * Toggle message expansion
	 */
	function toggleMessage(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	/**
	 * Get badge type for message
	 */
	function getBadgeType(messageType: string): string {
		const knownTypes = ['ESCALATION', 'ERROR', 'HANDOFF', 'DONE', 'POLECAT_DONE', 'TEST'];
		return knownTypes.includes(messageType) ? messageType : 'MESSAGE';
	}
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-xl font-semibold text-foreground">Mail Inbox</h1>
						<p class="text-sm text-muted-foreground">
							{data.messages.length} messages
							{#if data.unreadCount > 0}
								<span class="text-accent font-medium">({data.unreadCount} unread)</span>
							{/if}
						</p>
					</div>
				</div>
			</div>
		</header>

		<main class="container py-6">
			{#if data.error}
				<div class="panel-glass p-6 border-status-offline/30">
					<p class="text-status-offline font-medium">Failed to load inbox</p>
					<p class="text-sm text-muted-foreground mt-1">{data.error}</p>
				</div>
			{:else if data.messages.length === 0}
				<div class="panel-glass p-6 text-center">
					<p class="text-muted-foreground">No messages in inbox</p>
				</div>
			{:else}
				<div class="panel-glass overflow-hidden">
					<ul class="divide-y divide-border" role="list">
						{#each data.messages as message, index}
							{@const isExpanded = expandedId === message.id}
							<li
								class={cn(
									'transition-colors animate-blur-fade-up',
									!message.read && 'bg-accent/5'
								)}
								style="animation-delay: {index * 50}ms"
							>
								<button
									type="button"
									class="w-full text-left p-4 hover:bg-accent/5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset"
									onclick={() => toggleMessage(message.id)}
									aria-expanded={isExpanded}
								>
									<div class="flex items-start gap-3">
										<!-- Unread indicator -->
										<div class="flex-shrink-0 mt-1.5">
											{#if !message.read}
												<span class="block w-2 h-2 rounded-full bg-accent"></span>
											{:else}
												<span class="block w-2 h-2"></span>
											{/if}
										</div>

										<!-- Message content -->
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												<span
													class={typeBadgeVariants({
														type: getBadgeType(message.messageType) as
															| 'ESCALATION'
															| 'ERROR'
															| 'HANDOFF'
															| 'DONE'
															| 'POLECAT_DONE'
															| 'TEST'
															| 'MESSAGE'
													})}
												>
													{message.messageType}
												</span>
												<span class="text-sm font-medium text-foreground">
													{formatSender(message.from)}
												</span>
												<span class="text-xs text-muted-foreground ml-auto flex-shrink-0">
													{formatTime(message.timestamp)}
												</span>
											</div>

											<h3
												class="font-medium truncate"
												class:text-foreground={!message.read}
												class:text-muted-foreground={message.read}
											>
												{message.subject}
											</h3>

											{#if !isExpanded}
												<p class="text-sm text-muted-foreground truncate mt-1">
													{message.body}
												</p>
											{/if}
										</div>

										<!-- Expand indicator -->
										<div class="flex-shrink-0 text-muted-foreground">
											<svg
												class="w-5 h-5 transition-transform"
												class:rotate-180={isExpanded}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</div>
									</div>
								</button>

								<!-- Expanded message body -->
								{#if isExpanded}
									<div
										class="px-4 pb-4 pt-0 ml-9 border-l-2 border-accent/30 animate-blur-fade-up"
									>
										<div class="prose prose-sm prose-invert max-w-none">
											<pre
												class="whitespace-pre-wrap text-sm text-foreground bg-muted/30 p-4 rounded-md font-mono">{message.body}</pre>
										</div>
										<div class="mt-3 flex items-center justify-between">
											<div class="flex items-center gap-4 text-xs text-muted-foreground">
												<span>From: {message.from}</span>
												<span>ID: {message.id}</span>
												{#if message.threadId}
													<span>Thread: {message.threadId.slice(-8)}</span>
												{/if}
											</div>
											<a
												href="/mail/{message.id}"
												class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
											>
												View full message
												<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</a>
										</div>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</main>
	</div>
</div>
