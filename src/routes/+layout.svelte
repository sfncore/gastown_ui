<script lang="ts">
	import '../app.css';
	import { SkipLink, Announcer, BottomNav, Sidebar, GlobalSearch } from '$lib/components';
	import { preloadRoute } from '$lib/preload';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// Sidebar collapse state (persisted via Sidebar component)
	let sidebarCollapsed = $state(false);

	// Badge counts (fetched from API)
	let unreadMail = $state(0);
	let escalationCount = $state(0);

	// Accessibility: Route change announcement
	let routeAnnouncement = $state('');
	let mainContentRef = $state<HTMLElement | null>(null);

	// Navigation items for bottom nav (reactive for badge updates)
	// Grouped: Core → Operations → Communication → Monitoring → System
	// Primary items shown in bottom nav: Dashboard, Work, Agents, Mail + More
	const navItems = $derived([
		// Core (primary visibility)
		{ id: 'dashboard', label: 'Dashboard', href: '/', icon: '🏠' },
		{ id: 'work', label: 'Work', href: '/work', icon: '🎯' },
		{ id: 'agents', label: 'Agents', href: '/agents', icon: '🤖' },
		{ id: 'mail', label: 'Mail', href: '/mail', icon: '📬', badge: unreadMail || undefined },
		// Core (in overflow)
		{ id: 'queue', label: 'Queue', href: '/queue', icon: '📋' },
		// Operations
		{ id: 'convoys', label: 'Convoys', href: '/convoys', icon: '🚛' },
		{ id: 'workflows', label: 'Workflows', href: '/workflows', icon: '⚗️' },
		{ id: 'rigs', label: 'Rigs', href: '/rigs', icon: '🏭' },
		// Communication
		{ id: 'escalations', label: 'Alerts', href: '/escalations', icon: '🚨', badge: escalationCount || undefined },
		// Monitoring
		{ id: 'health', label: 'Health', href: '/health', icon: '🩺' },
		{ id: 'activity', label: 'Activity', href: '/activity', icon: '📊' },
		{ id: 'watchdog', label: 'Watchdog', href: '/watchdog', icon: '🐺' },
		// System
		{ id: 'crew', label: 'Crew', href: '/crew', icon: '👷' },
		{ id: 'dogs', label: 'Dogs', href: '/dogs', icon: '🐕' },
		{ id: 'settings', label: 'Settings', href: '/settings', icon: '⚙️' },
		{ id: 'logs', label: 'Logs', href: '/logs', icon: '📜' }
	]);

	// Determine active nav item from current route
	const activeId = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === '/') return 'dashboard';
		const segment = path.split('/')[1];
		return segment || 'dashboard';
	});

	// Hide nav on certain routes (login, etc.)
	const hideNav = $derived($page.url.pathname === '/login');

	// Preload routes on hover for instant navigation
	function handleNavHover(href: string) {
		preloadRoute(href);
	}

	// Fetch badge counts from status API
	async function fetchBadgeCounts() {
		try {
			const res = await fetch('/api/gastown/status');
			if (!res.ok) return;
			const status = await res.json();

			// Overseer unread mail
			unreadMail = status.overseer?.unread_mail ?? 0;

			// Sum agent unread mail as well
			const agentMail = status.agents?.reduce((sum: number, a: { unread_mail?: number }) => sum + (a.unread_mail ?? 0), 0) ?? 0;
			const rigAgentMail = status.rigs?.reduce((sum: number, r: { agents?: Array<{ unread_mail?: number }> }) =>
				sum + (r.agents?.reduce((s: number, a) => s + (a.unread_mail ?? 0), 0) ?? 0), 0) ?? 0;
			unreadMail += agentMail + rigAgentMail;

			// Escalation count (placeholder - will be implemented when escalations API is ready)
			escalationCount = status.escalation_count ?? 0;
		} catch (e) {
			console.error('Failed to fetch badge counts:', e);
		}
	}

	// Poll for badge counts
	onMount(() => {
		fetchBadgeCounts();
		const interval = setInterval(fetchBadgeCounts, 30000); // Poll every 30s
		return () => clearInterval(interval);
	});

	// Focus management and route announcements on navigation
	afterNavigate(({ to }) => {
		// Get page title from nav items or path
		const path = to?.url?.pathname || '/';
		const navItem = navItems.find((item) => item.href === path);
		const pageTitle = navItem?.label || getPageTitleFromPath(path);

		// Announce the page change for screen readers
		routeAnnouncement = `Navigated to ${pageTitle}`;

		// Focus the main content area for keyboard users
		// Use requestAnimationFrame to ensure DOM is updated
		requestAnimationFrame(() => {
			mainContentRef?.focus();
		});
	});

	// Get page title from path for pages not in nav
	function getPageTitleFromPath(path: string): string {
		const segment = path.split('/')[1] || 'Dashboard';
		return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
	}
</script>

<svelte:head>
	<title>Gas Town</title>
	<meta name="description" content="Gas Town - Multi-agent orchestration dashboard" />
</svelte:head>

<!-- Skip link for keyboard users -->
<SkipLink href="main-content" />

<!-- Screen reader announcements for route changes -->
<Announcer message={routeAnnouncement} clearAfter={3000} />

<!-- Layout wrapper with responsive sidebar/bottom nav -->
{#if !hideNav}
	<!-- Desktop layout with sidebar (hidden on mobile) -->
	<div class="hidden lg:flex min-h-screen">
		<!-- Sidebar navigation -->
		<Sidebar
			items={navItems}
			{activeId}
			bind:collapsed={sidebarCollapsed}
		/>

		<!-- Main content area -->
		<div class="flex-1 flex flex-col min-h-screen">
			<!-- Global search in header for desktop -->
			<div class="fixed top-4 right-4 z-40">
				<GlobalSearch />
			</div>

			<main
				bind:this={mainContentRef}
				id="main-content"
				tabindex="-1"
				class="flex-1 outline-none"
			>
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Mobile/Tablet layout with bottom nav (hidden on desktop) -->
	<div class="lg:hidden">
		<!-- Global search (mobile) -->
		<div class="fixed bottom-24 right-4 z-40">
			<GlobalSearch class="rounded-full p-3 shadow-lg" />
		</div>

		<!-- Main content area -->
		<div
			bind:this={mainContentRef}
			id="main-content"
			tabindex="-1"
			class="min-h-screen pb-20 outline-none"
		>
			{@render children()}
		</div>

		<!-- Bottom navigation with preload on hover -->
		<nav class="sr-only">
			{#each navItems as item}
				<a
					href={item.href}
					onmouseenter={() => handleNavHover(item.href)}
					onfocus={() => handleNavHover(item.href)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
		<BottomNav items={navItems} {activeId} />
	</div>
{:else}
	<!-- Login page - no navigation -->
	<div
		bind:this={mainContentRef}
		id="main-content"
		tabindex="-1"
		class="min-h-screen outline-none"
	>
		{@render children()}
	</div>
{/if}
