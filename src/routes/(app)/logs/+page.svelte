<script lang="ts">
	import { LogsLayout, LogEntry } from '$lib/components';

	// Server-loaded data
	let { data } = $props();

	function formatTime(isoString: string): string {
		return new Date(isoString).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<LogsLayout title="Activity Logs" sources={data.sources}>
	{#if data.error}
		<div class="p-8 text-center text-destructive">
			<p class="font-medium">Error loading logs</p>
			<p class="text-sm text-muted-foreground mt-2">{data.error}</p>
		</div>
	{:else if data.logs.length === 0}
		<div class="p-8 text-center text-muted-foreground">
			<p>No events found</p>
			<p class="text-sm mt-2">Events will appear here as Gas Town activity occurs.</p>
		</div>
	{:else}
		{#each data.logs as log, i}
			<LogEntry
				timestamp={formatTime(log.timestamp)}
				level={log.level}
				message={log.message}
				delay={i * 30}
			/>
		{/each}
	{/if}
</LogsLayout>
