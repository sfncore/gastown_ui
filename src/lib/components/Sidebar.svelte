<script lang="ts">
	import { tv } from 'tailwind-variants';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';

	/**
	 * Navigation item styling variants
	 */
	const navItemVariants = tv({
		base: 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
		variants: {
			active: {
				true: 'bg-primary/10 text-primary',
				false: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
			},
			collapsed: {
				true: 'justify-center px-2',
				false: ''
			}
		},
		defaultVariants: {
			active: false,
			collapsed: false
		}
	});

	/**
	 * Group header styling
	 */
	const groupHeaderVariants = tv({
		base: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3 transition-opacity duration-200',
		variants: {
			collapsed: {
				true: 'opacity-0 sr-only',
				false: 'opacity-100'
			}
		}
	});

	interface NavItem {
		id: string;
		label: string;
		href?: string;
		icon?: string;
		badge?: number | string;
	}

	interface NavGroup {
		id: string;
		label: string;
		items: NavItem[];
	}

	interface Props {
		items?: NavItem[];
		activeId?: string;
		collapsed?: boolean;
		onCollapseChange?: (collapsed: boolean) => void;
		class?: string;
	}

	let {
		items = [],
		activeId = '',
		collapsed = $bindable(false),
		onCollapseChange,
		class: className = ''
	}: Props = $props();

	// Group items by category
	const navGroups = $derived.by((): NavGroup[] => {
		const mainIds = ['dashboard', 'work', 'agents', 'mail'];
		const operationsIds = ['queue', 'convoys', 'workflows'];
		const systemIds = ['rigs', 'health', 'activity', 'watchdog', 'crew', 'dogs', 'settings', 'logs', 'escalations'];

		const mainItems = items.filter(item => mainIds.includes(item.id));
		const operationsItems = items.filter(item => operationsIds.includes(item.id));
		const systemItems = items.filter(item => systemIds.includes(item.id));

		return [
			{ id: 'main', label: 'Main', items: mainItems },
			{ id: 'operations', label: 'Operations', items: operationsItems },
			{ id: 'system', label: 'System', items: systemItems }
		].filter(group => group.items.length > 0);
	});

	// Keyboard navigation
	let navRef = $state<HTMLElement | null>(null);
	let focusedIndex = $state(-1);

	// Flatten items for keyboard navigation
	const flatItems = $derived(navGroups.flatMap(group => group.items));

	function handleKeyDown(event: KeyboardEvent) {
		const { key } = event;

		if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
			return;
		}

		event.preventDefault();

		if (key === 'ArrowDown') {
			focusedIndex = Math.min(focusedIndex + 1, flatItems.length - 1);
		} else if (key === 'ArrowUp') {
			focusedIndex = Math.max(focusedIndex - 1, 0);
		} else if (key === 'Home') {
			focusedIndex = 0;
		} else if (key === 'End') {
			focusedIndex = flatItems.length - 1;
		} else if ((key === 'Enter' || key === ' ') && focusedIndex >= 0) {
			const item = flatItems[focusedIndex];
			if (item?.href) {
				// Navigate programmatically
				window.location.href = item.href;
			}
		}

		// Focus the item
		if (focusedIndex >= 0 && navRef) {
			const links = navRef.querySelectorAll<HTMLAnchorElement>('[data-nav-item]');
			links[focusedIndex]?.focus();
		}
	}

	function toggleCollapse() {
		collapsed = !collapsed;
		onCollapseChange?.(collapsed);
	}

	// Load collapse state from localStorage
	onMount(() => {
		const stored = localStorage.getItem('sidebar-collapsed');
		if (stored !== null) {
			collapsed = stored === 'true';
		}
	});

	// Persist collapse state
	$effect(() => {
		localStorage.setItem('sidebar-collapsed', String(collapsed));
	});
</script>

<aside
	class={cn(
		'flex flex-col h-full bg-card/80 backdrop-blur-xl border-r border-border transition-all duration-300 ease-out',
		collapsed ? 'w-16' : 'w-64',
		className
	)}
	aria-label="Main navigation"
>
	<!-- Logo / Header -->
	<div class="flex items-center h-16 px-4 border-b border-border shrink-0">
		{#if collapsed}
			<span class="text-2xl" aria-hidden="true">&#x26FD;</span>
		{:else}
			<div class="flex items-center gap-2">
				<span class="text-2xl" aria-hidden="true">&#x26FD;</span>
				<span class="font-display font-semibold text-lg">Gas Town</span>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<nav
		bind:this={navRef}
		class="flex-1 overflow-y-auto py-4 px-2"
		role="navigation"
		aria-label="Sidebar navigation"
		onkeydown={handleKeyDown}
	>
		{#each navGroups as group, groupIndex}
			<div
				class={cn('mb-6', groupIndex > 0 && 'mt-2')}
				role="group"
				aria-labelledby={`nav-group-${group.id}`}
			>
				<h2
					id={`nav-group-${group.id}`}
					class={groupHeaderVariants({ collapsed })}
				>
					{group.label}
				</h2>
				<ul role="list" class="space-y-1">
					{#each group.items as item, itemIndex}
						{@const globalIndex = navGroups.slice(0, groupIndex).reduce((acc, g) => acc + g.items.length, 0) + itemIndex}
						{@const isActive = item.id === activeId}
						<li>
							<a
								href={item.href ?? '#'}
								class={cn(navItemVariants({ active: isActive, collapsed }))}
								aria-current={isActive ? 'page' : undefined}
								data-nav-item
								tabindex={focusedIndex === globalIndex ? 0 : -1}
								onfocus={() => focusedIndex = globalIndex}
								title={collapsed ? item.label : undefined}
							>
								<span class="relative shrink-0">
									{#if item.icon}
										<span class="text-xl w-6 h-6 flex items-center justify-center" aria-hidden="true">{item.icon}</span>
									{:else}
										<span class="w-6 h-6 rounded-full bg-current opacity-20" aria-hidden="true"></span>
									{/if}
									{#if item.badge}
										<span
											class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-destructive rounded-full flex items-center justify-center"
											aria-label="{item.badge} notifications"
										>
											{typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
										</span>
									{/if}
								</span>
								{#if !collapsed}
									<span class="text-sm font-medium truncate">{item.label}</span>
								{:else}
									<span class="sr-only">{item.label}</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<!-- Collapse toggle button -->
	<div class="shrink-0 border-t border-border p-2">
		<button
			onclick={toggleCollapse}
			class={cn(
				'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
				'text-muted-foreground hover:text-foreground hover:bg-muted/50',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				collapsed && 'justify-center px-2'
			)}
			aria-expanded={!collapsed}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<span
				class="text-xl w-6 h-6 flex items-center justify-center transition-transform duration-300"
				style:transform={collapsed ? 'rotate(180deg)' : 'rotate(0deg)'}
				aria-hidden="true"
			>
				&#x00AB;
			</span>
			{#if !collapsed}
				<span class="text-sm font-medium">Collapse</span>
			{/if}
		</button>
	</div>
</aside>
