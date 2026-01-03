<script lang="ts">
	import { tv } from 'tailwind-variants';
	import { cn } from '$lib/utils';
	import GridPattern from './GridPattern.svelte';

	/**
	 * Filter button variant definitions
	 */
	const filterButtonVariants = tv({
		base: 'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
		variants: {
			active: {
				true: 'bg-accent text-accent-foreground',
				false: 'bg-muted/50 text-muted-foreground hover:bg-muted'
			},
			level: {
				INF: 'data-[active=true]:bg-info/20 data-[active=true]:text-info',
				WRN: 'data-[active=true]:bg-warning/20 data-[active=true]:text-warning',
				ERR: 'data-[active=true]:bg-destructive/20 data-[active=true]:text-destructive',
				DBG: 'data-[active=true]:bg-muted data-[active=true]:text-muted-foreground'
			}
		},
		defaultVariants: {
			active: false
		}
	});

	interface Props {
		title?: string;
		sources?: string[];
		selectedLevels?: ('INF' | 'WRN' | 'ERR' | 'DBG')[];
		selectedSource?: string;
		searchQuery?: string;
		autoScroll?: boolean;
		class?: string;
	}

	let {
		title = 'Logs',
		sources = [],
		selectedLevels = ['INF', 'WRN', 'ERR', 'DBG'],
		selectedSource = '',
		searchQuery = '',
		autoScroll = true,
		class: className = ''
	}: Props = $props();

	const levels: ('INF' | 'WRN' | 'ERR' | 'DBG')[] = ['INF', 'WRN', 'ERR', 'DBG'];
</script>

<div class={cn('relative min-h-screen bg-background', className)}>
	<!-- Grid pattern background -->
	<GridPattern variant="lines" opacity={0.08} />

	<!-- Main content wrapper -->
	<div class="relative z-10 flex flex-col min-h-screen">
		<!-- Header -->
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container space-y-4">
				<div class="flex items-center justify-between">
					<h1 class="text-xl font-semibold text-foreground">{title}</h1>
					{#if $$slots.actions}
						<div class="flex items-center gap-2">
							<slot name="actions" />
						</div>
					{/if}
				</div>

				<!-- Filters -->
				<div class="flex flex-wrap items-center gap-4">
					<!-- Level filters -->
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">Level:</span>
						<div class="flex gap-1">
							{#each levels as level}
								<button
									class={filterButtonVariants({
										active: selectedLevels.includes(level),
										level
									})}
									data-active={selectedLevels.includes(level)}
								>
									{level}
								</button>
							{/each}
						</div>
					</div>

					<!-- Source filter -->
					{#if sources.length > 0}
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground">Source:</span>
							<select
								class="px-2 py-1 text-xs bg-muted border border-border rounded text-foreground"
								bind:value={selectedSource}
							>
								<option value="">All sources</option>
								{#each sources as source}
									<option value={source}>{source}</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Search -->
					<div class="flex-1 min-w-[200px]">
						<input
							type="search"
							placeholder="Search logs..."
							class="w-full px-3 py-1.5 text-sm bg-muted border border-border rounded text-foreground placeholder:text-muted-foreground"
							bind:value={searchQuery}
						/>
					</div>

					<!-- Auto-scroll toggle -->
					<label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
						<input
							type="checkbox"
							class="rounded border-border"
							bind:checked={autoScroll}
						/>
						Auto-scroll
					</label>
				</div>
			</div>
		</header>

		<!-- Log entries -->
		<main class="flex-1 container py-4">
			<div class="panel-glass overflow-hidden h-[calc(100vh-16rem)]">
				<div class="h-full overflow-y-auto" class:scroll-smooth={autoScroll}>
					{#if $$slots.default}
						<slot />
					{:else}
						<div class="p-8 text-center text-muted-foreground">
							<p>No log entries</p>
						</div>
					{/if}
				</div>
			</div>
		</main>

		<!-- Footer slot -->
		{#if $$slots.footer}
			<footer class="mt-auto border-t border-border px-4 py-3">
				<div class="container">
					<slot name="footer" />
				</div>
			</footer>
		{/if}
	</div>
</div>
