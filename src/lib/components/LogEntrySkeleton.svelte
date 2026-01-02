<script lang="ts">
	import Skeleton from './Skeleton.svelte';
	import { cn } from '$lib/utils';

	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- Log Entry Skeleton: matches the LogEntry component layout -->
<div
	class={cn('flex items-start gap-3 py-2 px-3 border-b border-border', className)}
	role="status"
	aria-label="Loading log entry"
	aria-busy="true"
>
	<!-- Timestamp -->
	<Skeleton type="text" width="auto" class="w-20 flex-shrink-0" />

	<!-- Level badge -->
	<Skeleton type="badge" width="auto" class="flex-shrink-0" />

	<!-- Message content -->
	<div class="flex-1 space-y-1">
		<Skeleton type="text" width="full" />
		<Skeleton type="text" width="2/3" />
	</div>
</div>
