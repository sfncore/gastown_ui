/**
 * Service Worker utilities for client-side usage
 */

import { browser } from '$app/environment';

// IndexedDB configuration (matching service-worker.ts)
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

/**
 * Check if the app is online
 */
export function isOnline(): boolean {
	if (!browser) return true;
	return navigator.onLine;
}

/**
 * Subscribe to online/offline status changes
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
	if (!browser) return () => {};

	const handleOnline = () => callback(true);
	const handleOffline = () => callback(false);

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
}

/**
 * Queue an action for background sync
 * When offline, stores the action in IndexedDB for later sync
 */
export async function queueAction(
	url: string,
	method: string,
	headers: Record<string, string>,
	body?: unknown
): Promise<boolean> {
	if (!browser) return false;

	const action: SyncAction = {
		id: crypto.randomUUID(),
		url,
		method,
		headers,
		body: body ? JSON.stringify(body) : '',
		timestamp: Date.now()
	};

	try {
		const db = await openDB();
		await addAction(db, action);

		// Request background sync
		if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
			const registration = await navigator.serviceWorker.ready;
			await registration.sync.register('sync-actions');
		}

		return true;
	} catch (error) {
		console.error('[SW] Failed to queue action:', error);
		return false;
	}
}

/**
 * Get count of pending actions
 */
export async function getPendingCount(): Promise<number> {
	if (!browser) return 0;

	try {
		const db = await openDB();
		const actions = await getAllActions(db);
		return actions.length;
	} catch {
		return 0;
	}
}

/**
 * Send a message to the service worker
 */
export function postMessage(type: string, payload?: unknown): void {
	if (!browser || !navigator.serviceWorker.controller) return;
	navigator.serviceWorker.controller.postMessage({ type, payload });
}

/**
 * Request the service worker to skip waiting and activate
 */
export function skipWaiting(): void {
	postMessage('SKIP_WAITING');
}

/**
 * Request the service worker to cache specific URLs
 */
export function cacheUrls(urls: string[]): void {
	postMessage('CACHE_URLS', { urls });
}

/**
 * Request the service worker to clear all caches
 */
export function clearCache(): void {
	postMessage('CLEAR_CACHE');
}

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
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

function addAction(db: IDBDatabase, action: SyncAction): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.add(action);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

function getAllActions(db: IDBDatabase): Promise<SyncAction[]> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}
