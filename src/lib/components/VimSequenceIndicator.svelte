<script lang="ts">
	/**
	 * VimSequenceIndicator
	 *
	 * Shows the pending key sequence (e.g., "g") when the user starts
	 * a vim-style key sequence. Automatically hides when the sequence
	 * completes or times out.
	 */
	import { onMount } from 'svelte';

	let isVisible = $state(false);
	let pendingKey = $state('');

	onMount(() => {
		const handleSequenceStart = (e: CustomEvent<{ prefix: string }>) => {
			pendingKey = e.detail.prefix;
			isVisible = true;
		};

		const handleSequenceEnd = () => {
			isVisible = false;
			pendingKey = '';
		};

		window.addEventListener('vim-sequence-start', handleSequenceStart as EventListener);
		window.addEventListener('vim-sequence-end', handleSequenceEnd as EventListener);

		return () => {
			window.removeEventListener('vim-sequence-start', handleSequenceStart as EventListener);
			window.removeEventListener('vim-sequence-end', handleSequenceEnd as EventListener);
		};
	});
</script>

{#if isVisible}
	<div class="vim-sequence-indicator" role="status" aria-live="polite">
		<span class="text-muted-foreground text-xs mr-1">Press:</span>
		<span class="text-foreground font-semibold">{pendingKey}</span>
		<span class="text-muted-foreground text-xs ml-1">+ key</span>
	</div>
{/if}
