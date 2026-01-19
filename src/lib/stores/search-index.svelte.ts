/**
 * Search Index Store - In-memory search index rebuilt from SWR cache
 *
 * Uses Fuse.js for fuzzy matching with instant search results.
 * Subscribes to SWR cache changes and rebuilds index automatically.
 *
 * Performance target: < 100ms for search operations
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import { swrCache, CACHE_KEYS } from './swr';
import type { Agent } from './agents.svelte';
import type { WorkItem } from './work.svelte';
import type { Convoy } from './convoys.svelte';
import type { MailItem } from './mail.svelte';

const browser = typeof window !== 'undefined';

export type SearchableType = 'agent' | 'work' | 'convoy' | 'mail';

export interface SearchableItem {
	id: string;
	type: SearchableType;
	title: string;
	subtitle?: string;
	path: string;
	score?: number;
	// Original data for additional context
	original: Agent | WorkItem | Convoy | MailItem;
}

interface SearchIndexState {
	items: SearchableItem[];
	isIndexing: boolean;
	lastIndexedAt: number | null;
	indexSize: number;
}

// Fuse.js configuration for fuzzy matching
const FUSE_OPTIONS: IFuseOptions<SearchableItem> = {
	keys: [
		{ name: 'title', weight: 0.5 },
		{ name: 'subtitle', weight: 0.3 },
		{ name: 'id', weight: 0.2 }
	],
	threshold: 0.4, // Lower = stricter matching
	distance: 100,
	minMatchCharLength: 1,
	includeScore: true,
	shouldSort: true,
	findAllMatches: true,
	ignoreLocation: true
};

class SearchIndexStore {
	#state = $state<SearchIndexState>({
		items: [],
		isIndexing: false,
		lastIndexedAt: null,
		indexSize: 0
	});

	#fuse: Fuse<SearchableItem> | null = null;
	#unsubscribers: (() => void)[] = [];
	#initialized = false;
	#debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		if (browser) {
			this.#init();
		}
	}

	#init() {
		if (this.#initialized) return;
		this.#initialized = true;

		// Subscribe to all relevant cache keys
		this.#unsubscribers.push(
			swrCache.subscribe<Agent[]>(CACHE_KEYS.AGENTS, () => this.#scheduleRebuild()),
			swrCache.subscribe<WorkItem[]>(CACHE_KEYS.WORK, () => this.#scheduleRebuild()),
			swrCache.subscribe<Convoy[]>(CACHE_KEYS.CONVOYS, () => this.#scheduleRebuild()),
			swrCache.subscribe<MailItem[]>(CACHE_KEYS.MAIL, () => this.#scheduleRebuild())
		);

		// Initial build
		this.#rebuildIndex();
	}

	get items(): SearchableItem[] {
		return this.#state.items;
	}

	get isIndexing(): boolean {
		return this.#state.isIndexing;
	}

	get lastIndexedAt(): number | null {
		return this.#state.lastIndexedAt;
	}

	get indexSize(): number {
		return this.#state.indexSize;
	}

	/**
	 * Search the index with fuzzy matching
	 * Returns results sorted by relevance score
	 */
	search(query: string, options?: { types?: SearchableType[]; limit?: number }): SearchableItem[] {
		if (!this.#fuse || !query.trim()) {
			return [];
		}

		const startTime = performance.now();

		let results = this.#fuse.search(query, { limit: options?.limit ?? 50 });

		// Filter by type if specified
		if (options?.types && options.types.length > 0) {
			results = results.filter((r) => options.types!.includes(r.item.type));
		}

		const searchTime = performance.now() - startTime;
		if (searchTime > 100) {
			console.warn(`Search took ${searchTime.toFixed(2)}ms, exceeds 100ms target`);
		}

		// Map to SearchableItem with score
		return results.map((r) => ({
			...r.item,
			score: r.score
		}));
	}

	/**
	 * Get items by type (unfiltered, for browsing)
	 */
	getByType(type: SearchableType): SearchableItem[] {
		return this.#state.items.filter((item) => item.type === type);
	}

	/**
	 * Schedule index rebuild with debounce to batch rapid updates
	 */
	#scheduleRebuild() {
		if (this.#debounceTimer) {
			clearTimeout(this.#debounceTimer);
		}

		this.#debounceTimer = setTimeout(() => {
			this.#rebuildIndex();
			this.#debounceTimer = null;
		}, 100); // 100ms debounce
	}

	/**
	 * Rebuild the search index from cached data
	 */
	#rebuildIndex() {
		this.#state.isIndexing = true;

		const startTime = performance.now();
		const items: SearchableItem[] = [];

		// Collect agents
		const agentsEntry = swrCache.get<Agent[]>(CACHE_KEYS.AGENTS);
		if (agentsEntry?.data) {
			for (const agent of agentsEntry.data) {
				items.push({
					id: agent.id,
					type: 'agent',
					title: agent.name,
					subtitle: agent.currentWork || `Status: ${agent.status}`,
					path: `/agents/${agent.id}`,
					original: agent
				});
			}
		}

		// Collect work items
		const workEntry = swrCache.get<WorkItem[]>(CACHE_KEYS.WORK);
		if (workEntry?.data) {
			for (const work of workEntry.data) {
				items.push({
					id: work.id,
					type: 'work',
					title: work.title,
					subtitle: `${work.id} · ${work.type} · P${work.priority}`,
					path: `/work/${work.id}`,
					original: work
				});
			}
		}

		// Collect convoys
		const convoysEntry = swrCache.get<Convoy[]>(CACHE_KEYS.CONVOYS);
		if (convoysEntry?.data) {
			for (const convoy of convoysEntry.data) {
				items.push({
					id: convoy.id,
					type: 'convoy',
					title: convoy.name,
					subtitle: `${convoy.status} · ${convoy.progress}%`,
					path: `/convoys/${convoy.id}`,
					original: convoy
				});
			}
		}

		// Collect mail
		const mailEntry = swrCache.get<MailItem[]>(CACHE_KEYS.MAIL);
		if (mailEntry?.data) {
			for (const mail of mailEntry.data) {
				items.push({
					id: mail.id,
					type: 'mail',
					title: mail.subject,
					subtitle: mail.from ? `From: ${mail.from}` : mail.type,
					path: `/mail/${mail.id}`,
					original: mail
				});
			}
		}

		// Create Fuse index
		this.#fuse = new Fuse(items, FUSE_OPTIONS);

		this.#state.items = items;
		this.#state.indexSize = items.length;
		this.#state.lastIndexedAt = Date.now();
		this.#state.isIndexing = false;

		const buildTime = performance.now() - startTime;
		if (buildTime > 50) {
			console.debug(`Search index rebuilt in ${buildTime.toFixed(2)}ms with ${items.length} items`);
		}
	}

	/**
	 * Force rebuild (useful after bulk operations)
	 */
	forceRebuild() {
		if (this.#debounceTimer) {
			clearTimeout(this.#debounceTimer);
			this.#debounceTimer = null;
		}
		this.#rebuildIndex();
	}

	/**
	 * Get statistics about the search index
	 */
	getStats() {
		return {
			totalItems: this.#state.indexSize,
			agents: this.#state.items.filter((i) => i.type === 'agent').length,
			work: this.#state.items.filter((i) => i.type === 'work').length,
			convoys: this.#state.items.filter((i) => i.type === 'convoy').length,
			mail: this.#state.items.filter((i) => i.type === 'mail').length,
			lastIndexedAt: this.#state.lastIndexedAt,
			isIndexing: this.#state.isIndexing
		};
	}

	destroy() {
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
		this.#fuse = null;
		this.#initialized = false;

		if (this.#debounceTimer) {
			clearTimeout(this.#debounceTimer);
			this.#debounceTimer = null;
		}
	}
}

export const searchIndex = new SearchIndexStore();

export function useSearchIndex() {
	return {
		get items() {
			return searchIndex.items;
		},
		get isIndexing() {
			return searchIndex.isIndexing;
		},
		get lastIndexedAt() {
			return searchIndex.lastIndexedAt;
		},
		get indexSize() {
			return searchIndex.indexSize;
		},
		search: (query: string, options?: { types?: SearchableType[]; limit?: number }) =>
			searchIndex.search(query, options),
		getByType: (type: SearchableType) => searchIndex.getByType(type),
		getStats: () => searchIndex.getStats(),
		forceRebuild: () => searchIndex.forceRebuild()
	};
}
