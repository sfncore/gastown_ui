import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { createSWRCache, TTL_PRESETS, withPresetTTL } from '../swr';
import { createTestLogger } from '../../../../../scripts/smoke/lib/logger';

const logger = createTestLogger('Unit: SWR Cache');
let testStartTime: number;
let stepCount = 0;

describe('SWRCache', () => {
	let cache: ReturnType<typeof createSWRCache>;

	beforeEach(() => {
		cache = createSWRCache();
		testStartTime = Date.now();
		stepCount = 0;
	});

	afterAll(() => {
		const duration = Date.now() - testStartTime;
		logger.summary('SWR Cache Tests', true, duration, stepCount);
	});

	describe('Cache Miss Behavior', () => {
		it('fetches and caches on miss', async () => {
			stepCount++;
			logger.step('Verify fetch and cache on miss');

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				return { data: 'test-value' };
			};

			logger.info('First get (cache miss)');
			const result1 = await cache.get('key1', fetcher);
			logger.info('Result', result1);

			expect(result1).toEqual({ data: 'test-value' });
			expect(fetchCount).toBe(1);

			logger.info('Second get (cache hit)');
			const result2 = await cache.get('key1', fetcher);
			logger.info('Result', result2);

			expect(result2).toEqual({ data: 'test-value' });
			expect(fetchCount).toBe(1); // Should not fetch again

			const stats = cache.getStats();
			logger.info('Cache stats', { hits: stats.hits, misses: stats.misses });

			expect(stats.misses).toBe(1);
			expect(stats.hits).toBe(1);

			logger.success('Cache miss triggers fetch, subsequent access uses cache');
		});

		it('increments miss counter correctly', async () => {
			stepCount++;
			logger.step('Verify miss counter increments');

			const fetcher = async () => 'value';

			await cache.get('key1', fetcher);
			await cache.get('key2', fetcher);
			await cache.get('key3', fetcher);

			const stats = cache.getStats();
			logger.info('Stats after 3 unique keys', stats);

			expect(stats.misses).toBe(3);
			expect(stats.size).toBe(3);

			logger.success('Miss counter tracks unique fetches');
		});
	});

	describe('Fresh Cache Hit Behavior', () => {
		it('returns cached data immediately for fresh entries', async () => {
			stepCount++;
			logger.step('Verify fresh cache hit returns immediately');

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				return `value-${fetchCount}`;
			};

			// First fetch
			await cache.get('key', fetcher, { staleTime: 60000 });
			expect(fetchCount).toBe(1);

			// Multiple rapid accesses
			const results = await Promise.all([
				cache.get('key', fetcher, { staleTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 60000 })
			]);

			logger.info('Results from 3 concurrent gets', results);

			// All should return original cached value
			expect(results.every((r) => r === 'value-1')).toBe(true);
			expect(fetchCount).toBe(1); // No additional fetches

			const stats = cache.getStats();
			logger.info('Stats', { hits: stats.hits, misses: stats.misses });

			expect(stats.hits).toBe(3);

			logger.success('Fresh cache hits return immediately without refetch');
		});
	});

	describe('Stale-While-Revalidate Behavior', () => {
		it('returns stale data and revalidates in background', async () => {
			stepCount++;
			logger.step('Verify SWR returns stale data while revalidating');

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				return `value-${fetchCount}`;
			};

			// Initial fetch with very short stale time but long cache time
			await cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 });
			expect(fetchCount).toBe(1);

			// Wait for entry to become stale
			logger.info('Waiting for entry to become stale (50ms)...');
			await new Promise((r) => setTimeout(r, 50));

			// Access stale entry - use longer staleTime for revalidation
			// This ensures the new entry won't be stale immediately after revalidation
			const staleResult = await cache.get('key', fetcher, { staleTime: 60000, cacheTime: 120000 });
			logger.info('Stale result (should be original value)', staleResult);

			// Should return stale data immediately
			expect(staleResult).toBe('value-1');

			const stats = cache.getStats();
			logger.info('Stats immediately after stale hit', {
				staleHits: stats.staleHits,
				hits: stats.hits
			});
			expect(stats.staleHits).toBe(1);

			// Wait for background revalidation to complete
			logger.info('Waiting for background revalidation (100ms)...');
			await new Promise((r) => setTimeout(r, 100));

			// Next access should get fresh data (entry was revalidated with staleTime: 60000)
			const freshResult = await cache.get('key', fetcher, { staleTime: 60000, cacheTime: 120000 });
			logger.info('Fresh result after revalidation', freshResult);

			expect(freshResult).toBe('value-2');
			expect(fetchCount).toBe(2);

			logger.success('SWR returns stale data immediately, revalidates in background');
		});

		it('only triggers one revalidation even with concurrent stale accesses', async () => {
			stepCount++;
			logger.step('Verify single revalidation for concurrent stale accesses');

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				await new Promise((r) => setTimeout(r, 50)); // Slow fetcher
				return `value-${fetchCount}`;
			};

			// Initial fetch
			await cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 });
			expect(fetchCount).toBe(1);

			// Wait for stale
			await new Promise((r) => setTimeout(r, 50));

			// Multiple concurrent stale accesses
			logger.info('Triggering 5 concurrent stale accesses');
			const results = await Promise.all([
				cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 }),
				cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 })
			]);

			logger.info('Results', results);

			// All should return stale value
			expect(results.every((r) => r === 'value-1')).toBe(true);

			// Wait for revalidation
			await new Promise((r) => setTimeout(r, 100));

			// Should only have triggered ONE additional fetch
			logger.info('Fetch count after revalidation', { fetchCount });
			expect(fetchCount).toBe(2);

			logger.success('Concurrent stale accesses trigger only one revalidation');
		});
	});

	describe('Cache Expiration', () => {
		it('treats expired entries as misses', async () => {
			stepCount++;
			logger.step('Verify expired entries trigger re-fetch');

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				return `value-${fetchCount}`;
			};

			// Initial fetch with very short cache time
			await cache.get('key', fetcher, { staleTime: 5, cacheTime: 20 });
			expect(fetchCount).toBe(1);

			// Wait for expiration
			logger.info('Waiting for cache expiration (50ms)...');
			await new Promise((r) => setTimeout(r, 50));

			// Access should trigger new fetch (miss, not stale)
			const result = await cache.get('key', fetcher, { staleTime: 5, cacheTime: 20 });
			logger.info('Result after expiration', result);

			expect(result).toBe('value-2');
			expect(fetchCount).toBe(2);

			const stats = cache.getStats();
			logger.info('Stats', stats);
			expect(stats.misses).toBe(2);

			logger.success('Expired entries are treated as cache misses');
		});
	});

	describe('Invalidation', () => {
		it('invalidates single key', async () => {
			stepCount++;
			logger.step('Verify single key invalidation');

			const fetcher = async () => 'value';

			await cache.get('key1', fetcher);
			await cache.get('key2', fetcher);

			let stats = cache.getStats();
			logger.info('Before invalidation', { size: stats.size });
			expect(stats.size).toBe(2);

			cache.invalidate('key1');

			stats = cache.getStats();
			logger.info('After invalidating key1', { size: stats.size });
			expect(stats.size).toBe(1);
			expect(cache.has('key1')).toBe(false);
			expect(cache.has('key2')).toBe(true);

			logger.success('Single key invalidation works');
		});

		it('invalidates by prefix', async () => {
			stepCount++;
			logger.step('Verify prefix invalidation');

			const fetcher = async () => 'value';

			await cache.get('work:1', fetcher);
			await cache.get('work:2', fetcher);
			await cache.get('work:3', fetcher);
			await cache.get('convoy:1', fetcher);

			let stats = cache.getStats();
			logger.info('Before invalidation', { size: stats.size });
			expect(stats.size).toBe(4);

			cache.invalidatePrefix('work:');

			stats = cache.getStats();
			logger.info('After invalidating work: prefix', { size: stats.size });
			expect(stats.size).toBe(1);
			expect(cache.has('work:1')).toBe(false);
			expect(cache.has('work:2')).toBe(false);
			expect(cache.has('convoy:1')).toBe(true);

			logger.success('Prefix invalidation works');
		});

		it('invalidates by pattern', async () => {
			stepCount++;
			logger.step('Verify pattern invalidation');

			const fetcher = async () => 'value';

			await cache.get('work:list', fetcher);
			await cache.get('work:123', fetcher);
			await cache.get('work:456', fetcher);
			await cache.get('convoy:list', fetcher);

			cache.invalidatePattern('work:*');

			const stats = cache.getStats();
			logger.info('After invalidating work:* pattern', { size: stats.size });
			expect(stats.size).toBe(1);
			expect(cache.has('convoy:list')).toBe(true);

			logger.success('Pattern invalidation works');
		});
	});

	describe('Stats Tracking', () => {
		it('tracks hits, misses, and stale hits accurately', async () => {
			stepCount++;
			logger.step('Verify stats accuracy');

			const fetcher = async () => 'value';

			// 3 misses
			await cache.get('key1', fetcher);
			await cache.get('key2', fetcher);
			await cache.get('key3', fetcher);

			// 2 fresh hits
			await cache.get('key1', fetcher, { staleTime: 60000 });
			await cache.get('key2', fetcher, { staleTime: 60000 });

			let stats = cache.getStats();
			logger.info('Stats', { hits: stats.hits, misses: stats.misses, staleHits: stats.staleHits });

			expect(stats.misses).toBe(3);
			expect(stats.hits).toBe(2);
			expect(stats.staleHits).toBe(0);

			logger.success('Stats tracking is accurate');
		});

		it('provides entry-level stats', async () => {
			stepCount++;
			logger.step('Verify entry-level stats');

			const fetcher = async () => 'value';
			await cache.get('mykey', fetcher, { staleTime: 5000, cacheTime: 60000 });

			const info = cache.getEntryInfo('mykey');
			logger.info('Entry info', info);

			expect(info).toBeDefined();
			expect(info?.key).toBe('mykey');
			expect(info?.isStale).toBe(false);
			expect(info?.revalidating).toBe(false);
			expect(info?.staleAt).toBeGreaterThan(Date.now());
			expect(info?.expiresAt).toBeGreaterThan(info?.staleAt ?? 0);

			logger.success('Entry-level stats available');
		});
	});

	describe('TTL Presets', () => {
		it('exports correct TTL presets', () => {
			stepCount++;
			logger.step('Verify TTL presets');

			logger.info('TTL_PRESETS', TTL_PRESETS);

			expect(TTL_PRESETS.status).toBe(5000);
			expect(TTL_PRESETS.agents).toBe(10000);
			expect(TTL_PRESETS.convoys).toBe(30000);
			expect(TTL_PRESETS.work).toBe(10000);
			expect(TTL_PRESETS.mail).toBe(5000);
			expect(TTL_PRESETS.capabilities).toBe(3600000);

			logger.success('TTL presets are correct');
		});

		it('withPresetTTL returns correct options', () => {
			stepCount++;
			logger.step('Verify withPresetTTL helper');

			const statusOpts = withPresetTTL('status');
			logger.info('Status preset options', statusOpts);

			expect(statusOpts.staleTime).toBe(5000);
			expect(statusOpts.cacheTime).toBe(50000); // 10x stale time

			const capabilitiesOpts = withPresetTTL('capabilities');
			logger.info('Capabilities preset options', capabilitiesOpts);

			expect(capabilitiesOpts.staleTime).toBe(3600000);
			expect(capabilitiesOpts.cacheTime).toBe(3600000); // Capped at 1 hour

			logger.success('withPresetTTL helper works correctly');
		});
	});

	describe('Utility Methods', () => {
		it('clear removes all entries and resets stats', async () => {
			stepCount++;
			logger.step('Verify clear method');

			const fetcher = async () => 'value';

			await cache.get('key1', fetcher);
			await cache.get('key2', fetcher);
			await cache.get('key1', fetcher); // Hit

			let stats = cache.getStats();
			logger.info('Before clear', stats);

			cache.clear();

			stats = cache.getStats();
			logger.info('After clear', stats);

			expect(stats.size).toBe(0);
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);

			logger.success('Clear removes all entries and resets stats');
		});

		it('cleanupExpired removes only expired entries', async () => {
			stepCount++;
			logger.step('Verify cleanupExpired');

			const fetcher = async () => 'value';

			// Entry with short cache time
			await cache.get('short', fetcher, { staleTime: 5, cacheTime: 20 });
			// Entry with long cache time
			await cache.get('long', fetcher, { staleTime: 60000, cacheTime: 120000 });

			let stats = cache.getStats();
			logger.info('Before wait', { size: stats.size });
			expect(stats.size).toBe(2);

			// Wait for short entry to expire
			logger.info('Waiting for short entry to expire (50ms)...');
			await new Promise((r) => setTimeout(r, 50));

			const cleaned = cache.cleanupExpired();
			logger.info('Cleaned entries', { cleaned });

			stats = cache.getStats();
			logger.info('After cleanup', { size: stats.size });

			expect(cleaned).toBe(1);
			expect(stats.size).toBe(1);
			expect(cache.has('short')).toBe(false);
			expect(cache.has('long')).toBe(true);

			logger.success('cleanupExpired removes only expired entries');
		});

		it('has returns correct presence status', async () => {
			stepCount++;
			logger.step('Verify has method');

			const fetcher = async () => 'value';

			expect(cache.has('nonexistent')).toBe(false);

			await cache.get('exists', fetcher, { staleTime: 60000, cacheTime: 120000 });
			expect(cache.has('exists')).toBe(true);

			cache.invalidate('exists');
			expect(cache.has('exists')).toBe(false);

			logger.success('has method works correctly');
		});

		it('set allows direct cache population', async () => {
			stepCount++;
			logger.step('Verify set method');

			cache.set('prefetched', { value: 'prefetched-data' });

			let fetchCount = 0;
			const fetcher = async () => {
				fetchCount++;
				return { value: 'fetched-data' };
			};

			const result = await cache.get('prefetched', fetcher);
			logger.info('Result from prefetched key', result);

			expect(result).toEqual({ value: 'prefetched-data' });
			expect(fetchCount).toBe(0);

			logger.success('set allows direct cache population');
		});
	});

	describe('Error Handling', () => {
		it('handles fetcher errors gracefully on miss', async () => {
			stepCount++;
			logger.step('Verify error handling on cache miss');

			const error = new Error('Fetch failed');
			const fetcher = async () => {
				throw error;
			};

			await expect(cache.get('key', fetcher)).rejects.toThrow('Fetch failed');

			// Cache should still be empty
			expect(cache.has('key')).toBe(false);

			logger.success('Fetcher errors propagate correctly on miss');
		});

		it('handles fetcher errors during revalidation without losing stale data', async () => {
			stepCount++;
			logger.step('Verify error handling during revalidation');

			let callCount = 0;
			const fetcher = async () => {
				callCount++;
				if (callCount === 2) {
					throw new Error('Revalidation failed');
				}
				return `value-${callCount}`;
			};

			// Initial fetch
			await cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 });
			expect(callCount).toBe(1);

			// Wait for stale
			await new Promise((r) => setTimeout(r, 50));

			// Access stale data - should return stale data and trigger revalidation
			const staleResult = await cache.get('key', fetcher, { staleTime: 10, cacheTime: 60000 });
			expect(staleResult).toBe('value-1');

			// Wait for failed revalidation
			await new Promise((r) => setTimeout(r, 50));

			// Entry should still exist with original data (not removed on revalidation error)
			expect(cache.has('key')).toBe(true);

			// Entry should no longer be marked as revalidating
			const info = cache.getEntryInfo('key');
			logger.info('Entry info after failed revalidation', info);
			expect(info?.revalidating).toBe(false);

			logger.success('Failed revalidation preserves stale data');
		});
	});

	describe('Edge Cases', () => {
		it('handles undefined return from fetcher', async () => {
			stepCount++;
			logger.step('Verify undefined value handling');

			const fetcher = async () => undefined;

			const result = await cache.get('key', fetcher);
			logger.info('Result', { result });

			expect(result).toBeUndefined();
			expect(cache.has('key')).toBe(true);

			logger.success('Undefined values are cached correctly');
		});

		it('handles null return from fetcher', async () => {
			stepCount++;
			logger.step('Verify null value handling');

			const fetcher = async () => null;

			const result = await cache.get('key', fetcher);
			logger.info('Result', { result });

			expect(result).toBeNull();
			expect(cache.has('key')).toBe(true);

			logger.success('Null values are cached correctly');
		});

		it('handles complex objects', async () => {
			stepCount++;
			logger.step('Verify complex object handling');

			const complexValue = {
				nested: { deeply: { value: 'test' } },
				array: [1, 2, 3],
				date: new Date().toISOString()
			};

			const fetcher = async () => complexValue;

			const result = await cache.get('key', fetcher);
			logger.info('Result', result);

			expect(result).toEqual(complexValue);
			expect(result.nested.deeply.value).toBe('test');

			logger.success('Complex objects cached correctly');
		});

		it('different keys remain independent', async () => {
			stepCount++;
			logger.step('Verify key independence');

			const fetcher1 = async () => 'value1';
			const fetcher2 = async () => 'value2';

			await cache.get('key1', fetcher1);
			await cache.get('key2', fetcher2);

			// Invalidating key1 should not affect key2
			cache.invalidate('key1');

			expect(cache.has('key1')).toBe(false);
			expect(cache.has('key2')).toBe(true);

			const result = await cache.get('key2', async () => 'new-value');
			expect(result).toBe('value2'); // Should still be cached

			logger.success('Keys are independent');
		});
	});
});
