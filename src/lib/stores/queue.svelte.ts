/**
 * Queue Store - Reactive store for merge queue management
 *
 * Uses Svelte 5 runes with SWR caching.
 * Tracks merge queue items, CI status, and merge progress.
 */

import { swrCache, CACHE_KEYS, CACHE_TTLS } from './swr';
import { apiClient } from '$lib/api/client';
import type { ApiResponse } from '$lib/api/types';

const browser = typeof window !== 'undefined';

export type MergeQueueStatus = 'pending' | 'processing' | 'merged' | 'failed';
export type CIStatus = 'pass' | 'fail' | 'pending';
export type MergeableStatus = 'ready' | 'conflict' | 'pending';

export interface MergeQueueItem {
	id: string;
	branch: string;
	repo: string;
	polecat: string;
	rig: string;
	status: MergeQueueStatus;
	priority: number;
	submitted_at: string;
	ci_status?: CIStatus;
	mergeable?: MergeableStatus;
	title?: string;
	author?: string;
	error?: string;
}

export interface QueueFilter {
	status?: MergeQueueStatus | MergeQueueStatus[];
	rig?: string;
	polecat?: string;
	ci_status?: CIStatus;
	mergeable?: MergeableStatus;
	search?: string;
}

interface QueueStoreState {
	items: MergeQueueItem[];
	isLoading: boolean;
	isValidating: boolean;
	error: Error | null;
	lastFetchedAt: number | null;
	filter: QueueFilter;
}

class QueueStore {
	#state = $state<QueueStoreState>({
		items: [],
		isLoading: false,
		isValidating: false,
		error: null,
		lastFetchedAt: null,
		filter: {}
	});

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

		this.#unsubscribers.push(
			swrCache.subscribe<MergeQueueItem[]>(CACHE_KEYS.QUEUE, (entry) => {
				if (entry) {
					this.#state.items = entry.data;
					this.#state.isValidating = entry.isRevalidating;
					this.#state.error = entry.error;
					this.#state.lastFetchedAt = entry.timestamp;
					this.#state.isLoading = false;
				}
			})
		);
	}

	get items(): MergeQueueItem[] {
		return this.#state.items;
	}

	get isLoading(): boolean {
		return this.#state.isLoading;
	}

	get isValidating(): boolean {
		return this.#state.isValidating;
	}

	get error(): Error | null {
		return this.#state.error;
	}

	get lastFetchedAt(): number | null {
		return this.#state.lastFetchedAt;
	}

	get filter(): QueueFilter {
		return this.#state.filter;
	}

	get filteredItems(): MergeQueueItem[] {
		return this.#applyFilter(this.#state.items, this.#state.filter);
	}

	get pendingItems(): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.status === 'pending');
	}

	get processingItems(): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.status === 'processing');
	}

	get mergedItems(): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.status === 'merged');
	}

	get failedItems(): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.status === 'failed');
	}

	get readyToMerge(): MergeQueueItem[] {
		return this.#state.items.filter(
			(item) => item.status === 'pending' && item.ci_status === 'pass' && item.mergeable === 'ready'
		);
	}

	get hasConflicts(): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.mergeable === 'conflict');
	}

	get pendingCount(): number {
		return this.pendingItems.length;
	}

	get processingCount(): number {
		return this.processingItems.length;
	}

	get totalCount(): number {
		return this.#state.items.length;
	}

	get byStatus(): Record<MergeQueueStatus, MergeQueueItem[]> {
		return {
			pending: this.pendingItems,
			processing: this.processingItems,
			merged: this.mergedItems,
			failed: this.failedItems
		};
	}

	get byRig(): Record<string, MergeQueueItem[]> {
		const result: Record<string, MergeQueueItem[]> = {};
		for (const item of this.#state.items) {
			if (!result[item.rig]) {
				result[item.rig] = [];
			}
			result[item.rig].push(item);
		}
		return result;
	}

	async fetch(): Promise<MergeQueueItem[]> {
		if (!this.#state.lastFetchedAt) {
			this.#state.isLoading = true;
		}

		try {
			const items = await swrCache.swr<MergeQueueItem[]>({
				key: CACHE_KEYS.QUEUE,
				fetcher: async () => {
					const response: ApiResponse<MergeQueueItem[]> = await apiClient.get('/api/gastown/queue');
					return response.data;
				},
				...CACHE_TTLS.REALTIME
			});

			return items;
		} catch (err) {
			this.#state.error = err instanceof Error ? err : new Error(String(err));
			throw err;
		} finally {
			this.#state.isLoading = false;
		}
	}

	async fetchForRig(rigName: string): Promise<MergeQueueItem[]> {
		const cacheKey = CACHE_KEYS.QUEUE_RIG(rigName);

		try {
			const items = await swrCache.swr<MergeQueueItem[]>({
				key: cacheKey,
				fetcher: async () => {
					const response: ApiResponse<MergeQueueItem[]> = await apiClient.get(
						`/api/gastown/queue/${rigName}`
					);
					return response.data;
				},
				...CACHE_TTLS.REALTIME
			});

			return items;
		} catch {
			return [];
		}
	}

	getItem(id: string): MergeQueueItem | undefined {
		return this.#state.items.find((item) => item.id === id);
	}

	getItemsByRig(rigName: string): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.rig === rigName);
	}

	getItemsByPolecat(polecat: string): MergeQueueItem[] {
		return this.#state.items.filter((item) => item.polecat === polecat);
	}

	setFilter(filter: QueueFilter): void {
		this.#state.filter = filter;
	}

	clearFilter(): void {
		this.#state.filter = {};
	}

	#applyFilter(items: MergeQueueItem[], filter: QueueFilter): MergeQueueItem[] {
		let result = items;

		if (filter.status) {
			const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
			result = result.filter((item) => statuses.includes(item.status));
		}

		if (filter.rig) {
			result = result.filter((item) => item.rig === filter.rig);
		}

		if (filter.polecat) {
			result = result.filter((item) => item.polecat === filter.polecat);
		}

		if (filter.ci_status) {
			result = result.filter((item) => item.ci_status === filter.ci_status);
		}

		if (filter.mergeable) {
			result = result.filter((item) => item.mergeable === filter.mergeable);
		}

		if (filter.search) {
			const search = filter.search.toLowerCase();
			result = result.filter(
				(item) =>
					item.branch.toLowerCase().includes(search) ||
					item.polecat.toLowerCase().includes(search) ||
					item.rig.toLowerCase().includes(search) ||
					item.title?.toLowerCase().includes(search) ||
					item.author?.toLowerCase().includes(search)
			);
		}

		return result;
	}

	invalidate(): void {
		swrCache.invalidate(CACHE_KEYS.QUEUE);
	}

	invalidateRig(rigName: string): void {
		swrCache.invalidate(CACHE_KEYS.QUEUE_RIG(rigName));
	}

	optimisticUpdate(id: string, updates: Partial<MergeQueueItem>): void {
		const idx = this.#state.items.findIndex((item) => item.id === id);
		if (idx === -1) return;

		const updated = { ...this.#state.items[idx], ...updates };
		this.#state.items = [
			...this.#state.items.slice(0, idx),
			updated,
			...this.#state.items.slice(idx + 1)
		];

		swrCache.set(CACHE_KEYS.QUEUE, this.#state.items, CACHE_TTLS.REALTIME);
	}

	optimisticAdd(item: MergeQueueItem): void {
		this.#state.items = [item, ...this.#state.items];
		swrCache.set(CACHE_KEYS.QUEUE, this.#state.items, CACHE_TTLS.REALTIME);
	}

	optimisticRemove(id: string): void {
		this.#state.items = this.#state.items.filter((item) => item.id !== id);
		swrCache.set(CACHE_KEYS.QUEUE, this.#state.items, CACHE_TTLS.REALTIME);
	}

	destroy(): void {
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
		this.#initialized = false;
	}
}

export const queueStore = new QueueStore();

export function useQueue() {
	return {
		get items() {
			return queueStore.items;
		},
		get filteredItems() {
			return queueStore.filteredItems;
		},
		get isLoading() {
			return queueStore.isLoading;
		},
		get isValidating() {
			return queueStore.isValidating;
		},
		get error() {
			return queueStore.error;
		},
		get byStatus() {
			return queueStore.byStatus;
		},
		get byRig() {
			return queueStore.byRig;
		},
		get pendingCount() {
			return queueStore.pendingCount;
		},
		get processingCount() {
			return queueStore.processingCount;
		},
		get readyToMerge() {
			return queueStore.readyToMerge;
		},
		get hasConflicts() {
			return queueStore.hasConflicts;
		},
		fetch: () => queueStore.fetch(),
		fetchForRig: (name: string) => queueStore.fetchForRig(name),
		getItem: (id: string) => queueStore.getItem(id),
		getItemsByRig: (name: string) => queueStore.getItemsByRig(name),
		setFilter: (filter: QueueFilter) => queueStore.setFilter(filter),
		clearFilter: () => queueStore.clearFilter(),
		invalidate: () => queueStore.invalidate()
	};
}
