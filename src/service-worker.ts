/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

// Cache names with version for invalidation
const CACHE_NAME = `gastown-ui-${version}`;
const ASSETS_CACHE = `${CACHE_NAME}-assets`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache (app shell)
const APP_SHELL = [
	...build, // Built JS/CSS files
	...files  // Static files
];

// API patterns for network-first strategy
const API_PATTERNS = [
	/\/api\//,
	/\/ws\//,
	/\/graphql/
];

/**
 * Install event - cache app shell
 */
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(ASSETS_CACHE);
			// Cache all app shell assets
			await cache.addAll(APP_SHELL);
			// Activate immediately
			await self.skipWaiting();
		})()
	);
});

/**
 * Activate event - clean old caches (version-based invalidation)
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			// Delete caches that don't match current version
			await Promise.all(
				keys
					.filter(key => key !== ASSETS_CACHE && key !== API_CACHE)
					.map(key => caches.delete(key))
			);
			// Take control of all clients immediately
			await self.clients.claim();
		})()
	);
});

/**
 * Fetch event - apply caching strategies
 */
self.addEventListener('fetch', (event: FetchEvent) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip cross-origin requests (except for trusted CDNs)
	if (url.origin !== self.location.origin) {
		return;
	}

	// Determine caching strategy based on request type
	if (isApiRequest(url)) {
		// Network-first for API requests
		event.respondWith(networkFirst(request, API_CACHE));
	} else if (isNavigationRequest(request)) {
		// Network-first for navigation, fallback to cached shell
		event.respondWith(navigationHandler(request));
	} else {
		// Cache-first for static assets
		event.respondWith(cacheFirst(request, ASSETS_CACHE));
	}
});

/**
 * Check if request is for API
 */
function isApiRequest(url: URL): boolean {
	return API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

/**
 * Check if request is navigation
 */
function isNavigationRequest(request: Request): boolean {
	return request.mode === 'navigate';
}

/**
 * Cache-first strategy - for static assets
 * Returns cached response if available, otherwise fetches from network
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		return cachedResponse;
	}

	try {
		const networkResponse = await fetch(request);
		// Cache successful responses
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch {
		// Return offline fallback for failed requests
		return new Response('Offline', {
			status: 503,
			statusText: 'Service Unavailable'
		});
	}
}

/**
 * Network-first strategy - for API requests
 * Tries network first, falls back to cache for offline support
 */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);

	try {
		const networkResponse = await fetch(request);
		// Cache successful GET responses
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch {
		// Offline - try cache
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		// No cache available
		return new Response(JSON.stringify({ error: 'offline', message: 'No network connection' }), {
			status: 503,
			statusText: 'Service Unavailable',
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Navigation handler - network-first with app shell fallback
 */
async function navigationHandler(request: Request): Promise<Response> {
	try {
		const networkResponse = await fetch(request);
		return networkResponse;
	} catch {
		// Offline - serve the app shell (SPA fallback)
		const cache = await caches.open(ASSETS_CACHE);
		const cachedResponse = await cache.match('/');
		if (cachedResponse) {
			return cachedResponse;
		}
		// Last resort - return offline page
		return new Response(offlineHTML(), {
			status: 200,
			headers: { 'Content-Type': 'text/html' }
		});
	}
}

/**
 * Offline HTML fallback
 */
function offlineHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Offline - Gas Town UI</title>
	<style>
		body {
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			background: #0a0a0a;
			color: #fafafa;
		}
		.container {
			text-align: center;
			padding: 2rem;
		}
		h1 { font-size: 1.5rem; margin-bottom: 1rem; }
		p { color: #a1a1aa; }
		button {
			margin-top: 1rem;
			padding: 0.75rem 1.5rem;
			background: #f97316;
			color: white;
			border: none;
			border-radius: 0.5rem;
			cursor: pointer;
			font-size: 1rem;
		}
		button:hover { background: #ea580c; }
	</style>
</head>
<body>
	<div class="container">
		<h1>You're offline</h1>
		<p>Check your connection and try again.</p>
		<button onclick="location.reload()">Retry</button>
	</div>
</body>
</html>`;
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event: SyncEvent) => {
	if (event.tag === 'sync-actions') {
		event.waitUntil(syncPendingActions());
	}
});

/**
 * Sync pending actions when back online
 */
async function syncPendingActions(): Promise<void> {
	// Get pending actions from IndexedDB
	const db = await openSyncDB();
	const actions = await getPendingActions(db);

	for (const action of actions) {
		try {
			await fetch(action.url, {
				method: action.method,
				headers: action.headers,
				body: action.body
			});
			await removeAction(db, action.id);
		} catch {
			// Action failed - will retry on next sync
			console.warn('Sync failed for action:', action.id);
		}
	}
}

// IndexedDB helpers for background sync
const DB_NAME = 'gastown-sync';
const STORE_NAME = 'pending-actions';

interface SyncAction {
	id: string;
	url: string;
	method: string;
	headers: Record<string, string>;
	body: string;
	timestamp: number;
}

function openSyncDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
}

function getPendingActions(db: IDBDatabase): Promise<SyncAction[]> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

function removeAction(db: IDBDatabase, id: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(id);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

/**
 * Message handler for client communication
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
	const { type, payload } = event.data || {};

	switch (type) {
		case 'SKIP_WAITING':
			self.skipWaiting();
			break;
		case 'CACHE_URLS':
			event.waitUntil(cacheUrls(payload?.urls || []));
			break;
		case 'CLEAR_CACHE':
			event.waitUntil(clearAllCaches());
			break;
	}
});

/**
 * Cache specific URLs on demand
 */
async function cacheUrls(urls: string[]): Promise<void> {
	const cache = await caches.open(ASSETS_CACHE);
	await cache.addAll(urls);
}

/**
 * Clear all caches (for logout/reset)
 */
async function clearAllCaches(): Promise<void> {
	const keys = await caches.keys();
	await Promise.all(keys.map(key => caches.delete(key)));
}
