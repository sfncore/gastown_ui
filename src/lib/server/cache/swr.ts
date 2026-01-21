/**
 * SWR (Stale-While-Revalidate) Cache
 *
 * Serves cached data immediately while revalidating in the background.
 * Provides instant perceived performance even when fetchers are slow.
 *
 * Behavior:
 * - Cache Hit (fresh) -> Return immediately
 * - Cache Hit (stale) -> Return immediately + trigger background revalidation
 * - Cache Miss -> Fetch + cache + return
 */

export interface SWROptions {
	/** Time in ms before data is considered stale (default 30000) */
	staleTime?: number;
	/** Time in ms before cache entry is deleted (default 300000) */
	cacheTime?: number;
}

export interface CacheEntryStats {
	key: string;
	createdAt: number;
	lastAccessedAt: number;
	staleAt: number;
	expiresAt: number;
	isStale: boolean;
	revalidating: boolean;
}

export interface CacheStats {
	hits: number;
	misses: number;
	staleHits: number;
	size: number;
	entries: Map<string, CacheEntryStats>;
}

interface CacheEntry<T> {
	data: T;
	createdAt: number;
	lastAccessedAt: number;
	staleAt: number;
	expiresAt: number;
	revalidating: boolean;
}

/**
 * TTL Presets for common data types
 */
export const TTL_PRESETS = {
	status: 5000, // System status (changes frequently)
	agents: 10000, // Agent list (changes occasionally)
	convoys: 30000, // Convoy list (changes rarely)
	work: 10000, // Work items (changes with activity)
	mail: 5000, // Mail (new messages)
	capabilities: 3600000 // Capabilities (rarely changes)
} as const;

const DEFAULT_STALE_TIME = 30000; // 30 seconds
const DEFAULT_CACHE_TIME = 300000; // 5 minutes

/**
 * SWR Cache implementation
 */
class SWRCacheImpl {
	private cache = new Map<string, CacheEntry<unknown>>();
	private stats = {
		hits: 0,
		misses: 0,
		staleHits: 0
	};

	/**
	 * Get a value from cache or fetch it
	 *
	 * @param key Cache key
	 * @param fetcher Function to fetch data if not cached or stale
	 * @param options Cache options
	 */
	async get<T>(key: string, fetcher: () => Promise<T>, options?: SWROptions): Promise<T> {
		const now = Date.now();
		const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
		const cacheTime = options?.cacheTime ?? DEFAULT_CACHE_TIME;

		const entry = this.cache.get(key) as CacheEntry<T> | undefined;

		// Cache miss - fetch and cache
		if (!entry) {
			this.stats.misses++;
			const data = await fetcher();
			this.setEntry(key, data, staleTime, cacheTime);
			return data;
		}

		// Update last accessed time
		entry.lastAccessedAt = now;

		// Check if entry has expired (past cacheTime)
		if (now >= entry.expiresAt) {
			// Entry expired, treat as miss
			this.cache.delete(key);
			this.stats.misses++;
			const data = await fetcher();
			this.setEntry(key, data, staleTime, cacheTime);
			return data;
		}

		// Check if entry is stale
		const isStale = now >= entry.staleAt;

		if (isStale) {
			// Stale hit - return cached data and trigger background revalidation
			this.stats.staleHits++;

			// Only revalidate if not already revalidating
			if (!entry.revalidating) {
				entry.revalidating = true;
				this.revalidateInBackground(key, fetcher, staleTime, cacheTime);
			}

			return entry.data;
		}

		// Fresh hit - return immediately
		this.stats.hits++;
		return entry.data;
	}

	/**
	 * Invalidate a single cache key
	 */
	invalidate(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Invalidate all cache keys matching a prefix
	 */
	invalidatePrefix(prefix: string): void {
		const keys = Array.from(this.cache.keys());
		for (const key of keys) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Invalidate cache keys matching a pattern (supports * wildcard)
	 */
	invalidatePattern(pattern: string): void {
		// Convert pattern to regex: "work:*" -> /^work:.*$/
		const regexPattern = pattern.replace(/\*/g, '.*');
		const regex = new RegExp(`^${regexPattern}$`);

		const keys = Array.from(this.cache.keys());
		for (const key of keys) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const now = Date.now();
		const entries = new Map<string, CacheEntryStats>();

		const cacheEntries = Array.from(this.cache.entries());
		for (const [key, entry] of cacheEntries) {
			entries.set(key, {
				key,
				createdAt: entry.createdAt,
				lastAccessedAt: entry.lastAccessedAt,
				staleAt: entry.staleAt,
				expiresAt: entry.expiresAt,
				isStale: now >= entry.staleAt,
				revalidating: entry.revalidating
			});
		}

		return {
			hits: this.stats.hits,
			misses: this.stats.misses,
			staleHits: this.stats.staleHits,
			size: this.cache.size,
			entries
		};
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.stats = { hits: 0, misses: 0, staleHits: 0 };
	}

	/**
	 * Cleanup expired entries
	 * Call periodically to prevent memory buildup
	 */
	cleanupExpired(): number {
		const now = Date.now();
		let cleaned = 0;

		const cacheEntries = Array.from(this.cache.entries());
		for (const [key, entry] of cacheEntries) {
			if (now >= entry.expiresAt) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Set a cache entry directly (useful for prefetching)
	 */
	set<T>(key: string, data: T, options?: SWROptions): void {
		const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
		const cacheTime = options?.cacheTime ?? DEFAULT_CACHE_TIME;
		this.setEntry(key, data, staleTime, cacheTime);
	}

	/**
	 * Check if a key exists in cache (regardless of staleness)
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		// Check if expired
		if (Date.now() >= entry.expiresAt) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Get raw entry info (for debugging)
	 */
	getEntryInfo(key: string): CacheEntryStats | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		const now = Date.now();
		return {
			key,
			createdAt: entry.createdAt,
			lastAccessedAt: entry.lastAccessedAt,
			staleAt: entry.staleAt,
			expiresAt: entry.expiresAt,
			isStale: now >= entry.staleAt,
			revalidating: entry.revalidating
		};
	}

	private setEntry<T>(key: string, data: T, staleTime: number, cacheTime: number): void {
		const now = Date.now();
		this.cache.set(key, {
			data,
			createdAt: now,
			lastAccessedAt: now,
			staleAt: now + staleTime,
			expiresAt: now + cacheTime,
			revalidating: false
		});
	}

	private revalidateInBackground<T>(
		key: string,
		fetcher: () => Promise<T>,
		staleTime: number,
		cacheTime: number
	): void {
		// Fire and forget - don't await
		fetcher()
			.then((data) => {
				this.setEntry(key, data, staleTime, cacheTime);
			})
			.catch(() => {
				// On error, just mark as not revalidating so next access can retry
				const entry = this.cache.get(key);
				if (entry) {
					entry.revalidating = false;
				}
			});
	}
}

/**
 * Singleton SWR cache instance
 */
export const swrCache = new SWRCacheImpl();

/**
 * Create a new isolated SWR cache (useful for testing)
 */
export function createSWRCache(): SWRCacheImpl {
	return new SWRCacheImpl();
}

/**
 * Helper to create a cache key with preset TTL
 */
export function withPresetTTL(
	preset: keyof typeof TTL_PRESETS
): Pick<SWROptions, 'staleTime' | 'cacheTime'> {
	const staleTime = TTL_PRESETS[preset];
	// Cache time is 10x stale time by default, capped at 1 hour
	const cacheTime = Math.min(staleTime * 10, 3600000);
	return { staleTime, cacheTime };
}
