<script lang="ts">
	/**
	 * (auth) Route Group Layout
	 *
	 * Minimal layout for authentication routes (login, logout).
	 * Intentionally omits navigation chrome - auth pages render standalone.
	 *
	 * Route groups in SvelteKit use parentheses and don't affect URL paths:
	 * - (auth)/login/+page.svelte -> /login
	 */

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<!--
	The (auth) layout renders children without additional navigation.
	The root layout will detect /login path and hide nav components.
-->
{@render children()}
