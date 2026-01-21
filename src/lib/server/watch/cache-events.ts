/**
 * Cache Invalidation Event Emitter
 *
 * Shared event emitter for cache invalidation events.
 * Connects beads-watcher to SSE stream for real-time cache updates.
 */

import { EventEmitter } from 'events';

export interface CacheInvalidationEvent {
	type: 'cache_invalidate';
	timestamp: string;
	data: {
		entityType: 'work' | 'convoy' | 'agent' | 'mail' | 'config' | 'all';
		entityId?: string;
		changeType: 'create' | 'update' | 'delete';
		patterns: string[];
	};
}

/**
 * Invalidation pattern map: file types to cache key patterns
 */
export const INVALIDATION_PATTERNS: Record<string, string[]> = {
	work: ['work', 'work:*', 'convoys'],
	convoy: ['convoys', 'convoy:*', 'work'],
	agent: ['agents', 'agent:*'],
	mail: ['mail', 'mail:*'],
	config: ['capabilities', 'diagnostics'],
	event: ['work', 'convoys', 'agents', 'mail'],
	unknown: ['work', 'convoys', 'agents', 'mail']
};

class CacheEventEmitter extends EventEmitter {
	emitInvalidation(event: CacheInvalidationEvent): boolean {
		return super.emit('invalidate', event);
	}

	onInvalidation(listener: (event: CacheInvalidationEvent) => void): this {
		return super.on('invalidate', listener);
	}

	offInvalidation(listener: (event: CacheInvalidationEvent) => void): this {
		return super.off('invalidate', listener);
	}
}

export const cacheEventEmitter = new CacheEventEmitter();

/**
 * Emit a cache invalidation event
 */
export function emitCacheInvalidation(
	entityType: CacheInvalidationEvent['data']['entityType'],
	changeType: CacheInvalidationEvent['data']['changeType'],
	entityId?: string
): void {
	const patterns = INVALIDATION_PATTERNS[entityType] ?? INVALIDATION_PATTERNS.unknown;

	const event: CacheInvalidationEvent = {
		type: 'cache_invalidate',
		timestamp: new Date().toISOString(),
		data: {
			entityType,
			entityId,
			changeType,
			patterns
		}
	};

	cacheEventEmitter.emitInvalidation(event);
}
