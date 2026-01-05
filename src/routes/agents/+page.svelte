<script lang="ts">
	import { AgentCard, GridPattern } from '$lib/components';

	const { data } = $props();
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container">
				<h1 class="text-xl font-semibold text-foreground">Agents</h1>
				<p class="text-sm text-muted-foreground">All active agents in Gas Town</p>
			</div>
		</header>

		<main class="container py-6">
			{#if data.error}
				<div class="panel-glass p-6 border-status-offline/30">
					<p class="text-status-offline font-medium">Failed to load agents</p>
					<p class="text-sm text-muted-foreground mt-1">{data.error}</p>
				</div>
			{:else if data.agents.length === 0}
				<div class="panel-glass p-6">
					<p class="text-muted-foreground">No agents found</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{#each data.agents as agent}
						<a href="/agents/{agent.id}" class="block transition-transform hover:scale-[1.02]">
							<AgentCard
								name={agent.name}
								task={agent.task}
								status={agent.status}
								progress={agent.progress}
								meta={agent.meta}
							/>
						</a>
					{/each}
				</div>
			{/if}
		</main>
	</div>
</div>
