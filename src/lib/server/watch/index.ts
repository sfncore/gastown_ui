/**
 * Watchers Index
 *
 * Exports and initializes file watchers for real-time updates.
 * Connects beads-watcher to cache invalidation event emitter.
 */

import { BeadsWatcher, type BeadChange } from './beads-watcher';
import { cacheEventEmitter, emitCacheInvalidation, type CacheInvalidationEvent } from './cache-events';

export { BeadsWatcher, type BeadChange } from './beads-watcher';
export {
	cacheEventEmitter,
	emitCacheInvalidation,
	INVALIDATION_PATTERNS,
	type CacheInvalidationEvent
} from './cache-events';

let globalWatcher: BeadsWatcher | null = null;

/**
 * Initialize and start the beads watcher
 * Automatically wires changes to cache invalidation events
 */
export async function initBeadsWatcher(beadsPath: string): Promise<BeadsWatcher> {
	if (globalWatcher) {
		return globalWatcher;
	}

	const watcher = new BeadsWatcher({
		beadsPath,
		debounceMs: 50,
		onError: (error) => {
			console.error('[BeadsWatcher] Error:', error);
		}
	});

	watcher.onChange((change: BeadChange) => {
		const entityType = mapEntityType(change.entityType);
		emitCacheInvalidation(entityType, change.type, change.entityId);
	});

	await watcher.start();
	globalWatcher = watcher;

	return watcher;
}

/**
 * Stop and cleanup the global watcher
 */
export function stopBeadsWatcher(): void {
	if (globalWatcher) {
		globalWatcher.stop();
		globalWatcher = null;
	}
}

/**
 * Get the current watcher instance (if running)
 */
export function getBeadsWatcher(): BeadsWatcher | null {
	return globalWatcher;
}

/**
 * Map BeadEntityType to CacheInvalidationEvent entityType
 */
function mapEntityType(
	entityType: BeadChange['entityType']
): CacheInvalidationEvent['data']['entityType'] {
	switch (entityType) {
		case 'work':
			return 'work';
		case 'convoy':
			return 'convoy';
		case 'agent':
			return 'agent';
		case 'mail':
			return 'mail';
		case 'event':
			return 'all';
		default:
			return 'all';
	}
}
