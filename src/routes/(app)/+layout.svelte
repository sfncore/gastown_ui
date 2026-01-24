<script lang="ts">
	/**
	 * (app) Route Group Layout
	 *
	 * This layout wraps all main application routes (dashboard, work, agents, etc.)
	 * It inherits the root layout which provides navigation components.
	 *
	 * Route groups in SvelteKit use parentheses and don't affect URL paths:
	 * - (app)/work/+page.svelte -> /work
	 * - (app)/agents/+page.svelte -> /agents
	 */

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<!--
	The (app) layout simply renders children.
	Navigation is provided by the root +layout.svelte which checks hideNav.
	Since (app) routes are NOT /login, they get the full navigation.
-->
{@render children()}
