/**
 * Cache Sync - Real-time SWR cache invalidation via SSE
 *
 * Listens to the activity stream for cache invalidation events
 * and updates the SWR cache accordingly.
 *
 * Usage:
 *   import { initCacheSync } from '$lib/stores/cache-sync';
 *   onMount(() => initCacheSync());
 */

import { ActivityStream, type StreamEvent } from '$lib/api/activity-stream';
import { swrCache } from './swr';

const browser = typeof window !== 'undefined';

interface CacheInvalidationData {
	entityType: 'work' | 'convoy' | 'agent' | 'mail' | 'config' | 'all';
	entityId?: string;
	changeType: 'create' | 'update' | 'delete';
	patterns: string[];
}

/**
 * Pattern mapping for invalidation
 * Maps entity types to SWR cache key patterns
 */
const INVALIDATION_REGEX: Record<string, RegExp[]> = {
	work: [/^work/, /^convoys/],
	convoy: [/^convoy/, /^convoys/, /^work/],
	agent: [/^agent/, /^agents/],
	mail: [/^mail/],
	config: [/^capabilities/, /^diagnostics/],
	all: [/^work/, /^convoy/, /^agent/, /^mail/, /^capabilities/, /^diagnostics/]
};

let stream: ActivityStream | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Type guard for cache invalidation data
 */
function isCacheInvalidationData(data: unknown): data is CacheInvalidationData {
	if (typeof data !== 'object' || data === null) return false;
	const d = data as Record<string, unknown>;
	return (
		typeof d.entityType === 'string' &&
		typeof d.changeType === 'string' &&
		Array.isArray(d.patterns)
	);
}

/**
 * Handle cache invalidation event
 */
function handleCacheInvalidation(event: StreamEvent): void {
	if (event.type !== 'cache_invalidate') return;

	if (!isCacheInvalidationData(event.data)) return;

	const data = event.data;
	const patterns = INVALIDATION_REGEX[data.entityType] ?? INVALIDATION_REGEX.all;

	for (const pattern of patterns) {
		swrCache.invalidatePattern(pattern);
	}

	// If specific entity ID provided, invalidate that specific key too
	if (data.entityId) {
		const specificKey = `${data.entityType}:${data.entityId}`;
		swrCache.invalidate(specificKey);
	}
}

/**
 * Initialize cache sync with activity stream
 * Call this once when the app starts (e.g., in root layout)
 */
export function initCacheSync(sseUrl = '/api/gastown/feed/stream'): () => void {
	if (!browser) {
		return () => {};
	}

	// Don't initialize twice
	if (stream) {
		return () => disconnectCacheSync();
	}

	stream = new ActivityStream(sseUrl);

	// Listen for cache invalidation events
	unsubscribe = stream.on('cache_invalidate', handleCacheInvalidation);

	// Also listen with wildcard in case event type comes through differently
	const wildcardUnsub = stream.on('*', (event) => {
		if (event.type === 'cache_invalidate') {
			handleCacheInvalidation(event);
		}
	});

	stream.connect();

	return () => {
		unsubscribe?.();
		wildcardUnsub();
		disconnectCacheSync();
	};
}

/**
 * Disconnect cache sync
 */
export function disconnectCacheSync(): void {
	if (stream) {
		stream.disconnect();
		stream.removeAllListeners();
		stream = null;
	}
	unsubscribe = null;
}

/**
 * Check if cache sync is connected
 */
export function isCacheSyncConnected(): boolean {
	return stream?.isConnected ?? false;
}

/**
 * Svelte 5 runes-based hook for cache sync status
 */
export function useCacheSync() {
	let connected = $state(false);

	$effect(() => {
		if (!browser) return;

		const cleanup = initCacheSync();

		// Check connection status periodically
		const interval = setInterval(() => {
			connected = isCacheSyncConnected();
		}, 1000);

		return () => {
			clearInterval(interval);
			cleanup();
		};
	});

	return {
		get connected() {
			return connected;
		}
	};
}
