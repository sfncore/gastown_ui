<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import '../app.css';

	let { children } = $props();

	// Service worker state
	let swRegistration = $state<ServiceWorkerRegistration | null>(null);
	let updateAvailable = $state(false);

	onMount(() => {
		if (browser && 'serviceWorker' in navigator) {
			registerServiceWorker();
			registerBackgroundSync();
		}
	});

	/**
	 * Register service worker
	 */
	async function registerServiceWorker() {
		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js', {
				scope: '/'
			});

			swRegistration = registration;

			// Check for updates
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New version available
							updateAvailable = true;
						}
					});
				}
			});

			// Handle controller change (page refresh after update)
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				window.location.reload();
			});

			console.log('[SW] Service worker registered:', registration.scope);
		} catch (error) {
			console.error('[SW] Registration failed:', error);
		}
	}

	/**
	 * Register background sync
	 */
	async function registerBackgroundSync() {
		if (!('sync' in ServiceWorkerRegistration.prototype)) {
			console.warn('[SW] Background sync not supported');
			return;
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			await registration.sync.register('sync-actions');
			console.log('[SW] Background sync registered');
		} catch (error) {
			console.error('[SW] Background sync registration failed:', error);
		}
	}

	/**
	 * Apply pending update
	 */
	function applyUpdate() {
		if (swRegistration?.waiting) {
			swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	}
</script>

<svelte:head>
	<title>Gas Town UI</title>
</svelte:head>

<!-- Update notification -->
{#if updateAvailable}
	<div class="update-banner" role="alert">
		<span>A new version is available.</span>
		<button onclick={applyUpdate}>Update now</button>
	</div>
{/if}

{@render children()}

<style>
	.update-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: #1c1917;
		border-top: 1px solid #292524;
		color: #fafafa;
		font-size: 0.875rem;
		z-index: 9999;
	}

	.update-banner button {
		padding: 0.5rem 1rem;
		background: #f97316;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.update-banner button:hover {
		background: #ea580c;
	}
</style>
