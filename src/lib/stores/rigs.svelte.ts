/**
 * Rigs Store - Reactive store for rig management
 *
 * Uses Svelte 5 runes with SWR caching.
 * Tracks rig status, agents, and configuration.
 */

import { swrCache, CACHE_KEYS, CACHE_TTLS } from './swr';
import { apiClient } from '$lib/api/client';
import type { ApiResponse } from '$lib/api/types';

const browser = typeof window !== 'undefined';

export type RigStatus = 'pending' | 'cloning' | 'active' | 'parked' | 'error';

export interface RigAgent {
	name: string;
	role: string;
	status: string;
}

export interface RigConfig {
	main_branch: string;
	work_branch_prefix: string;
	auto_merge: boolean;
	require_review: boolean;
}

export interface Rig {
	name: string;
	path: string;
	worktree_root?: string;
	branch?: string;
	remote?: string;
	agents: RigAgent[];
	config?: RigConfig;
	docked: boolean;
	status: RigStatus;
	polecat_count?: number;
	crew_count?: number;
	has_witness?: boolean;
	has_refinery?: boolean;
}

export interface RigFilter {
	status?: RigStatus | RigStatus[];
	docked?: boolean;
	search?: string;
}

interface RigsStoreState {
	items: Rig[];
	isLoading: boolean;
	isValidating: boolean;
	error: Error | null;
	lastFetchedAt: number | null;
	filter: RigFilter;
}

class RigsStore {
	#state = $state<RigsStoreState>({
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
			swrCache.subscribe<Rig[]>(CACHE_KEYS.RIGS, (entry) => {
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

	get items(): Rig[] {
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

	get filter(): RigFilter {
		return this.#state.filter;
	}

	get filteredItems(): Rig[] {
		return this.#applyFilter(this.#state.items, this.#state.filter);
	}

	get activeRigs(): Rig[] {
		return this.#state.items.filter((r) => r.status === 'active');
	}

	get parkedRigs(): Rig[] {
		return this.#state.items.filter((r) => r.status === 'parked');
	}

	get dockedRigs(): Rig[] {
		return this.#state.items.filter((r) => r.docked);
	}

	get errorRigs(): Rig[] {
		return this.#state.items.filter((r) => r.status === 'error');
	}

	get totalAgentCount(): number {
		return this.#state.items.reduce((sum, rig) => sum + rig.agents.length, 0);
	}

	get byStatus(): Record<RigStatus, Rig[]> {
		return {
			pending: this.#state.items.filter((r) => r.status === 'pending'),
			cloning: this.#state.items.filter((r) => r.status === 'cloning'),
			active: this.activeRigs,
			parked: this.parkedRigs,
			error: this.errorRigs
		};
	}

	async fetch(): Promise<Rig[]> {
		if (!this.#state.lastFetchedAt) {
			this.#state.isLoading = true;
		}

		try {
			const items = await swrCache.swr<Rig[]>({
				key: CACHE_KEYS.RIGS,
				fetcher: async () => {
					const response: ApiResponse<Rig[]> = await apiClient.get('/api/gastown/rigs');
					return response.data;
				},
				...CACHE_TTLS.FAST
			});

			return items;
		} catch (err) {
			this.#state.error = err instanceof Error ? err : new Error(String(err));
			throw err;
		} finally {
			this.#state.isLoading = false;
		}
	}

	async fetchRig(name: string): Promise<Rig | null> {
		const cacheKey = CACHE_KEYS.RIG(name);

		try {
			const rig = await swrCache.swr<Rig>({
				key: cacheKey,
				fetcher: async () => {
					const response: ApiResponse<Rig> = await apiClient.get(`/api/gastown/rigs/${name}`);
					return response.data;
				},
				...CACHE_TTLS.FAST
			});

			return rig;
		} catch {
			return null;
		}
	}

	getRig(name: string): Rig | undefined {
		return this.#state.items.find((r) => r.name === name);
	}

	getRigAgents(rigName: string): RigAgent[] {
		const rig = this.getRig(rigName);
		return rig?.agents ?? [];
	}

	setFilter(filter: RigFilter): void {
		this.#state.filter = filter;
	}

	clearFilter(): void {
		this.#state.filter = {};
	}

	#applyFilter(items: Rig[], filter: RigFilter): Rig[] {
		let result = items;

		if (filter.status) {
			const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
			result = result.filter((r) => statuses.includes(r.status));
		}

		if (filter.docked !== undefined) {
			result = result.filter((r) => r.docked === filter.docked);
		}

		if (filter.search) {
			const search = filter.search.toLowerCase();
			result = result.filter(
				(r) =>
					r.name.toLowerCase().includes(search) ||
					r.path.toLowerCase().includes(search) ||
					r.agents.some((a) => a.name.toLowerCase().includes(search))
			);
		}

		return result;
	}

	invalidate(): void {
		swrCache.invalidate(CACHE_KEYS.RIGS);
	}

	invalidateRig(name: string): void {
		swrCache.invalidate(CACHE_KEYS.RIG(name));
	}

	optimisticUpdate(name: string, updates: Partial<Rig>): void {
		const idx = this.#state.items.findIndex((r) => r.name === name);
		if (idx === -1) return;

		const updated = { ...this.#state.items[idx], ...updates };
		this.#state.items = [
			...this.#state.items.slice(0, idx),
			updated,
			...this.#state.items.slice(idx + 1)
		];

		swrCache.set(CACHE_KEYS.RIGS, this.#state.items, CACHE_TTLS.FAST);
	}

	optimisticAdd(rig: Rig): void {
		this.#state.items = [rig, ...this.#state.items];
		swrCache.set(CACHE_KEYS.RIGS, this.#state.items, CACHE_TTLS.FAST);
	}

	optimisticRemove(name: string): void {
		this.#state.items = this.#state.items.filter((r) => r.name !== name);
		swrCache.set(CACHE_KEYS.RIGS, this.#state.items, CACHE_TTLS.FAST);
	}

	destroy(): void {
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
		this.#initialized = false;
	}
}

export const rigsStore = new RigsStore();

export function useRigs() {
	return {
		get items() {
			return rigsStore.items;
		},
		get filteredItems() {
			return rigsStore.filteredItems;
		},
		get isLoading() {
			return rigsStore.isLoading;
		},
		get isValidating() {
			return rigsStore.isValidating;
		},
		get error() {
			return rigsStore.error;
		},
		get byStatus() {
			return rigsStore.byStatus;
		},
		get activeRigs() {
			return rigsStore.activeRigs;
		},
		get totalAgentCount() {
			return rigsStore.totalAgentCount;
		},
		fetch: () => rigsStore.fetch(),
		getRig: (name: string) => rigsStore.getRig(name),
		getRigAgents: (name: string) => rigsStore.getRigAgents(name),
		setFilter: (filter: RigFilter) => rigsStore.setFilter(filter),
		clearFilter: () => rigsStore.clearFilter(),
		invalidate: () => rigsStore.invalidate()
	};
}
