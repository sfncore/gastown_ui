<script lang="ts">
	import Skeleton from './Skeleton.svelte';
	import { cn } from '$lib/utils';

	let { class: className = '' }: { class?: string } = $props();
</script>

<!-- Agent Card Skeleton: matches the AgentCard component layout -->
<div
	class={cn('panel-glass p-4 space-y-3', className)}
	role="status"
	aria-label="Loading agent card"
	aria-busy="true"
>
	<!-- Header: Avatar + Name/Status -->
	<div class="flex items-center gap-3">
		<Skeleton type="avatar" width="auto" />
		<div class="flex-1 space-y-2">
			<Skeleton type="title" width="2/3" />
			<Skeleton type="text" width="1/3" />
		</div>
	</div>

	<!-- Body: Description lines -->
	<div class="space-y-2">
		<Skeleton type="text" width="full" />
		<Skeleton type="text" width="3/4" />
	</div>

	<!-- Footer: Action buttons -->
	<div class="flex gap-2 pt-2">
		<Skeleton type="button" width="1/4" />
		<Skeleton type="button" width="1/4" />
	</div>
</div>
