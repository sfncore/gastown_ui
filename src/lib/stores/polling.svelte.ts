/**
 * Multi-Tier Polling System with SWR (Stale-While-Revalidate)
 *
 * Provides:
 * - Multiple polling tiers (fast, medium, slow) based on data importance
 * - SWR pattern: show cached/stale data while fetching fresh data
 * - Automatic pause when tab is hidden
 * - Integration with network state (pause when offline)
 * - Configurable polling intervals per resource
 * - Request deduplication
 * - Error handling with exponential backoff
 */

import { networkState } from './network.svelte';
import { apiClient, isApiError } from '$lib/api/client';
import type { ApiResponse } from '$lib/api/types';

const browser = typeof window !== 'undefined';

/** Polling tier presets */
export const POLLING_TIERS = {
	REALTIME: 2000, // 2s - critical real-time data
	FAST: 5000, // 5s - important data that changes frequently
	MEDIUM: 15000, // 15s - moderate updates
	SLOW: 60000, // 60s - background updates
	VERY_SLOW: 300000 // 5min - rarely changing data
} as const;

/** Resource state including cached data and metadata */
export interface ResourceState<T> {
	data: T | null;
	isLoading: boolean;
	isValidating: boolean;
	isStale: boolean;
	error: Error | null;
	lastFetchedAt: number | null;
	lastValidatedAt: number | null;
	retryCount: number;
}

/** Polling configuration for a resource */
export interface PollingConfig<T> {
	/** Unique key for the resource */
	key: string;
	/** API endpoint path */
	endpoint: string;
	/** Polling interval in milliseconds */
	interval: number;
	/** Whether to start polling immediately */
	enabled?: boolean;
	/** Whether to pause polling when tab is hidden */
	pauseWhenHidden?: boolean;
	/** Whether to pause polling when offline */
	pauseWhenOffline?: boolean;
	/** Maximum retry attempts on error */
	maxRetries?: number;
	/** Stale time - data is considered stale after this duration (ms) */
	staleTime?: number;
	/** Cache time - data is kept in cache for this duration (ms) */
	cacheTime?: number;
	/** Transform response data */
	transform?: (data: unknown) => T;
	/** Callback when data updates */
	onSuccess?: (data: T) => void;
	/** Callback on error */
	onError?: (error: Error) => void;
}

/** Default configuration values */
const DEFAULT_CONFIG = {
	enabled: true,
	pauseWhenHidden: true,
	pauseWhenOffline: true,
	maxRetries: 3,
	staleTime: 5000,
	cacheTime: 300000
};

/** Polling instance for a single resource */
class PollingInstance<T> {
	#config: Required<PollingConfig<T>>;
	#state = $state<ResourceState<T>>({
		data: null,
		isLoading: false,
		isValidating: false,
		isStale: false,
		error: null,
		lastFetchedAt: null,
		lastValidatedAt: null,
		retryCount: 0
	});
	#timerId: ReturnType<typeof setTimeout> | null = null;
	#abortController: AbortController | null = null;
	#isPolling = false;
	#isPaused = false;

	constructor(config: PollingConfig<T>) {
		this.#config = { ...DEFAULT_CONFIG, ...config } as Required<PollingConfig<T>>;

		if (browser && this.#config.enabled) {
			this.start();
		}
	}

	get state(): ResourceState<T> {
		return this.#state;
	}

	get data(): T | null {
		return this.#state.data;
	}

	get error(): Error | null {
		return this.#state.error;
	}

	get isLoading(): boolean {
		return this.#state.isLoading;
	}

	get isValidating(): boolean {
		return this.#state.isValidating;
	}

	start() {
		if (this.#isPolling) return;
		this.#isPolling = true;
		this.#isPaused = false;
		this.#scheduleFetch(0);
	}

	stop() {
		this.#isPolling = false;
		this.#clearTimer();
		this.#cancelRequest();
	}

	pause() {
		this.#isPaused = true;
		this.#clearTimer();
	}

	resume() {
		if (!this.#isPolling) return;
		this.#isPaused = false;
		this.#scheduleFetch(0);
	}

	async refetch(): Promise<void> {
		this.#clearTimer();
		await this.#fetch();
		if (this.#isPolling && !this.#isPaused) {
			this.#scheduleFetch(this.#config.interval);
		}
	}

	mutate(data: T) {
		this.#state.data = data;
		this.#state.lastFetchedAt = Date.now();
		this.#state.lastValidatedAt = Date.now();
		this.#state.isStale = false;
		this.#state.error = null;
	}

	destroy() {
		this.stop();
	}

	#scheduleFetch(delay: number) {
		this.#clearTimer();

		if (this.#isPaused) return;

		// Check if should pause based on visibility
		if (this.#config.pauseWhenHidden && browser && document.hidden) {
			return;
		}

		// Check if should pause based on network
		if (this.#config.pauseWhenOffline && networkState.isOffline) {
			return;
		}

		this.#timerId = setTimeout(() => {
			this.#fetch().then(() => {
				if (this.#isPolling && !this.#isPaused) {
					this.#scheduleFetch(this.#config.interval);
				}
			});
		}, delay);
	}

	async #fetch() {
		// Cancel any in-flight request
		this.#cancelRequest();

		// Create new abort controller
		this.#abortController = new AbortController();

		// Check if data is stale
		const now = Date.now();
		const isStale = !this.#state.lastFetchedAt ||
			now - this.#state.lastFetchedAt > this.#config.staleTime;

		// Set loading/validating state
		if (!this.#state.data) {
			this.#state.isLoading = true;
		} else if (isStale) {
			this.#state.isValidating = true;
			this.#state.isStale = true;
		}

		try {
			const response: ApiResponse<T> = await apiClient.get<T>(
				this.#config.endpoint,
				{ signal: this.#abortController.signal }
			);

			let data = response.data;
			if (this.#config.transform) {
				data = this.#config.transform(data);
			}

			// Update state
			this.#state.data = data;
			this.#state.error = null;
			this.#state.lastFetchedAt = now;
			this.#state.lastValidatedAt = now;
			this.#state.isStale = false;
			this.#state.retryCount = 0;

			// Call success callback
			if (this.#config.onSuccess) {
				this.#config.onSuccess(data);
			}
		} catch (error) {
			// Ignore aborted requests
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			const err = error instanceof Error ? error : new Error(String(error));
			this.#state.error = err;
			this.#state.retryCount++;

			// Call error callback
			if (this.#config.onError) {
				this.#config.onError(err);
			}

			// Exponential backoff for retries
			if (this.#state.retryCount < this.#config.maxRetries && isApiError(error) && error.retryable) {
				const backoff = Math.min(1000 * Math.pow(2, this.#state.retryCount - 1), 30000);
				console.warn(`Polling ${this.#config.key} failed, retrying in ${backoff}ms (attempt ${this.#state.retryCount}/${this.#config.maxRetries})`);
				this.#scheduleFetch(backoff);
				return;
			}
		} finally {
			this.#state.isLoading = false;
			this.#state.isValidating = false;
			this.#abortController = null;
		}
	}

	#clearTimer() {
		if (this.#timerId) {
			clearTimeout(this.#timerId);
			this.#timerId = null;
		}
	}

	#cancelRequest() {
		if (this.#abortController) {
			this.#abortController.abort();
			this.#abortController = null;
		}
	}
}

/** Polling manager that handles multiple resources */
class PollingManager {
	#instances = new Map<string, PollingInstance<unknown>>();
	#unsubscribers: (() => void)[] = [];
	#initialized = false;

	constructor() {
		if (browser) {
			this.#init();
		}
	}

	#init() {
		if (this.#initialized) return;
		this.#initialized = true;

		// Pause all polling when tab is hidden, resume when visible
		const handleVisibilityChange = () => {
			if (document.hidden) {
				this.pauseAll();
			} else {
				this.resumeAll();
			}
		};

		if (browser) {
			document.addEventListener('visibilitychange', handleVisibilityChange);
			this.#unsubscribers.push(() => {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			});
		}

		// Pause when offline, resume when online
		this.#unsubscribers.push(
			networkState.onStatusChange((isOnline) => {
				if (isOnline) {
					this.resumeAll();
				} else {
					this.pauseAll();
				}
			})
		);
	}

	create<T>(config: PollingConfig<T>): PollingInstance<T> {
		if (this.#instances.has(config.key)) {
			return this.#instances.get(config.key) as PollingInstance<T>;
		}

		const instance = new PollingInstance<T>(config);
		this.#instances.set(config.key, instance as PollingInstance<unknown>);
		return instance;
	}

	get<T>(key: string): PollingInstance<T> | undefined {
		return this.#instances.get(key) as PollingInstance<T> | undefined;
	}

	remove(key: string) {
		const instance = this.#instances.get(key);
		if (instance) {
			instance.destroy();
			this.#instances.delete(key);
		}
	}

	pauseAll() {
		for (const instance of this.#instances.values()) {
			instance.pause();
		}
	}

	resumeAll() {
		for (const instance of this.#instances.values()) {
			instance.resume();
		}
	}

	stopAll() {
		for (const instance of this.#instances.values()) {
			instance.stop();
		}
	}

	clear() {
		for (const instance of this.#instances.values()) {
			instance.destroy();
		}
		this.#instances.clear();
	}

	destroy() {
		this.clear();
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
		this.#initialized = false;
	}
}

// Singleton instance
export const pollingManager = new PollingManager();

/**
 * Create a polling resource with SWR pattern
 *
 * @example
 * const agentsPoller = usePolling({
 *   key: 'agents',
 *   endpoint: '/api/gastown/agents',
 *   interval: POLLING_TIERS.FAST,
 *   transform: (data) => data as Agent[]
 * });
 *
 * // In component
 * $effect(() => {
 *   console.log('Agents:', agentsPoller.data);
 * });
 */
export function usePolling<T>(config: PollingConfig<T>): PollingInstance<T> {
	return pollingManager.create(config);
}

/**
 * Get existing polling instance
 */
export function getPolling<T>(key: string): PollingInstance<T> | undefined {
	return pollingManager.get<T>(key);
}

/**
 * Remove polling instance
 */
export function removePolling(key: string): void {
	pollingManager.remove(key);
}

/**
 * Helper to create multi-tier polling for related resources
 *
 * @example
 * const { critical, normal, background } = createMultiTierPolling({
 *   critical: [
 *     { key: 'agents', endpoint: '/api/agents' }
 *   ],
 *   normal: [
 *     { key: 'queue', endpoint: '/api/queue' }
 *   ],
 *   background: [
 *     { key: 'stats', endpoint: '/api/stats' }
 *   ]
 * });
 */
export function createMultiTierPolling<T = unknown>(config: {
	critical?: Array<Omit<PollingConfig<T>, 'interval'>>;
	normal?: Array<Omit<PollingConfig<T>, 'interval'>>;
	background?: Array<Omit<PollingConfig<T>, 'interval'>>;
}) {
	const instances = {
		critical: [] as PollingInstance<T>[],
		normal: [] as PollingInstance<T>[],
		background: [] as PollingInstance<T>[]
	};

	if (config.critical) {
		instances.critical = config.critical.map((c) =>
			usePolling({ ...c, interval: POLLING_TIERS.FAST })
		);
	}

	if (config.normal) {
		instances.normal = config.normal.map((c) =>
			usePolling({ ...c, interval: POLLING_TIERS.MEDIUM })
		);
	}

	if (config.background) {
		instances.background = config.background.map((c) =>
			usePolling({ ...c, interval: POLLING_TIERS.SLOW })
		);
	}

	return instances;
}
