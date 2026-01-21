/**
 * Cache Events Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheEventEmitter, emitCacheInvalidation, INVALIDATION_PATTERNS } from './cache-events';

describe('cacheEventEmitter', () => {
	let listener: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		listener = vi.fn();
	});

	afterEach(() => {
		cacheEventEmitter.offInvalidation(listener);
	});

	it('emits invalidation events', () => {
		cacheEventEmitter.onInvalidation(listener);

		emitCacheInvalidation('work', 'update', 'gu-123');

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'cache_invalidate',
				data: expect.objectContaining({
					entityType: 'work',
					changeType: 'update',
					entityId: 'gu-123',
					patterns: INVALIDATION_PATTERNS.work
				})
			})
		);
	});

	it('includes timestamp in events', () => {
		cacheEventEmitter.onInvalidation(listener);

		emitCacheInvalidation('mail', 'create');

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				timestamp: expect.any(String)
			})
		);

		const event = listener.mock.calls[0][0];
		expect(new Date(event.timestamp).getTime()).not.toBeNaN();
	});

	it('uses correct patterns for each entity type', () => {
		cacheEventEmitter.onInvalidation(listener);

		emitCacheInvalidation('convoy', 'delete');

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					patterns: INVALIDATION_PATTERNS.convoy
				})
			})
		);
	});

	it('falls back to unknown patterns for unrecognized types', () => {
		cacheEventEmitter.onInvalidation(listener);

		// TypeScript ensures this but test runtime behavior
		emitCacheInvalidation('all', 'update');

		expect(listener).toHaveBeenCalled();
	});

	it('can unsubscribe from events', () => {
		cacheEventEmitter.onInvalidation(listener);
		cacheEventEmitter.offInvalidation(listener);

		emitCacheInvalidation('work', 'update');

		expect(listener).not.toHaveBeenCalled();
	});
});

describe('INVALIDATION_PATTERNS', () => {
	it('has patterns for all entity types', () => {
		expect(INVALIDATION_PATTERNS.work).toContain('work');
		expect(INVALIDATION_PATTERNS.convoy).toContain('convoys');
		expect(INVALIDATION_PATTERNS.agent).toContain('agents');
		expect(INVALIDATION_PATTERNS.mail).toContain('mail');
		expect(INVALIDATION_PATTERNS.config).toContain('capabilities');
	});

	it('work invalidation includes convoys (cascade)', () => {
		expect(INVALIDATION_PATTERNS.work).toContain('convoys');
	});
});
