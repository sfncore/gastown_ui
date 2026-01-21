<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { keyboardManager } from '$lib/utils/keyboard';
	import { getVimManager, type VimShortcut } from '$lib/utils/keyboard-vim';
	import type { Shortcut } from '$lib/utils/keyboard';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let isOpen = $state(false);
	let shortcuts = $state<Array<[string, Shortcut]>>([]);
	let vimShortcuts = $state<VimShortcut[]>([]);

	onMount(() => {
		// Listen for help toggle
		const handleToggle = (e: CustomEvent) => {
			isOpen = e.detail.open;
		};

		window.addEventListener('keyboard-help-toggle', handleToggle as EventListener);

		// Load shortcuts from both managers
		if (keyboardManager) {
			shortcuts = keyboardManager.getShortcuts();
		}

		const vimManager = getVimManager();
		if (vimManager) {
			vimShortcuts = vimManager.getShortcuts();
		}

		// Listen for Escape key
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				isOpen = false;
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keyboard-help-toggle', handleToggle as EventListener);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	function groupShortcuts() {
		const grouped = new Map<string, Array<[string, Shortcut]>>();
		for (const [id, shortcut] of shortcuts) {
			const category = shortcut.category || 'action';
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push([id, shortcut]);
		}
		return grouped;
	}

	function groupVimShortcuts() {
		const grouped = new Map<string, VimShortcut[]>();
		for (const shortcut of vimShortcuts) {
			const category = shortcut.category || 'action';
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(shortcut);
		}
		return grouped;
	}

	function formatVimKey(key: string | string[]): string {
		if (Array.isArray(key)) {
			return key.join(' ');
		}
		if (key === 'enter') return 'Enter';
		if (key === 'escape') return 'Esc';
		return key;
	}

	const categoryLabels: Record<string, string> = {
		navigation: 'Navigation',
		action: 'Actions',
		system: 'System',
		list: 'List Navigation'
	};

	// Define display order for categories
	const categoryOrder = ['navigation', 'list', 'action', 'system'];

	// Computed grouped shortcuts
	const vimGrouped = $derived(groupVimShortcuts());
	const modifierGrouped = $derived(groupShortcuts());

	function closeDialog() {
		isOpen = false;
	}
</script>

<!-- Help Dialog -->
{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
		onclick={closeDialog}
		role="presentation"
	></div>

	<!-- Dialog -->
	<div
		class={cn(
			'fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-2xl mx-auto rounded-lg border border-border bg-card shadow-lg max-h-[80vh] overflow-y-auto',
			className
		)}
		role="dialog"
		aria-labelledby="help-title"
		aria-modal="true"
	>
		<!-- Header -->
		<div class="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
			<h2 id="help-title" class="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
			<button
				onclick={closeDialog}
				class="p-2.5 -m-1 rounded-md hover:bg-muted transition-colors touch-target-interactive"
				aria-label="Close help"
			>
				<X class="w-5 h-5 text-muted-foreground" />
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-6">
			<!-- Vim-style shortcuts (organized by category) -->
			{#each categoryOrder as category}
				{#if (vimGrouped.get(category) || []).length > 0}
					<div>
						<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
							{categoryLabels[category] || category}
						</h3>
						<div class="grid gap-2">
							{#each vimGrouped.get(category) || [] as shortcut}
								<div class="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
									<span class="text-sm text-foreground">{shortcut.description}</span>
									<code class="text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
										{formatVimKey(shortcut.key)}
									</code>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			<!-- Modifier-based shortcuts from original manager -->
			{#if modifierGrouped.size > 0}
				<div>
					<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
						Modifier Shortcuts
					</h3>
					<div class="grid gap-2">
						{#each Array.from(modifierGrouped.entries()) as [_, categoryShortcuts]}
							{#each categoryShortcuts as [_, shortcut]}
								<div class="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
									<span class="text-sm text-foreground">{shortcut.description}</span>
									<code class="text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
										{keyboardManager.formatShortcut(shortcut.keys)}
									</code>
								</div>
							{/each}
						{/each}
					</div>
				</div>
			{/if}

			{#if shortcuts.length === 0 && vimShortcuts.length === 0}
				<p class="text-sm text-muted-foreground text-center py-8">
					No keyboard shortcuts registered yet.
				</p>
			{/if}
		</div>

		<!-- Footer -->
		<div class="sticky bottom-0 bg-card border-t border-border p-4">
			<p class="text-xs text-muted-foreground text-center">
				Press <code class="inline-block px-2 py-1 rounded bg-muted font-mono">Esc</code> to close
			</p>
		</div>
	</div>
{/if}

<style>
	/* Ensure smooth scrolling on iOS */
	div[role='dialog'] {
		-webkit-overflow-scrolling: touch;
	}
</style>
