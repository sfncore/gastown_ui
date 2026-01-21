/**
 * SSE Integration Store - Connects Server-Sent Events to reactive stores
 *
 * Uses Svelte 5 runes to manage SSE connection state and automatically
 * invalidate stores when relevant events are received.
 *
 * Event types:
 * - work_changed: Invalidate work store
 * - convoy_changed: Invalidate convoys store
 * - agent_changed: Invalidate agents store
 * - mail_changed: Invalidate mail store
 * - rig_changed: Invalidate rigs store
 * - queue_changed: Invalidate queue store
 * - operations_changed: Invalidate operations store
 */

import { ActivityStream, type StreamEvent } from '$lib/api/activity-stream';
import { workStore } from './work.svelte';
import { convoysStore } from './convoys.svelte';
import { agentsStore } from './agents.svelte';
import { mailStore } from './mail.svelte';
import { rigsStore } from './rigs.svelte';
import { queueStore } from './queue.svelte';

const browser = typeof window !== 'undefined';

export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface SSEEvent {
	type: string;
	timestamp: string;
	data: Record<string, unknown>;
}

export type SSEEventType =
	| 'work_changed'
	| 'convoy_changed'
	| 'agent_changed'
	| 'mail_changed'
	| 'rig_changed'
	| 'queue_changed'
	| 'operations_changed'
	| '*';

type EventHandler = (event: SSEEvent) => void;

class SSEStore {
	#stream: ActivityStream | null = null;
	#connectionState = $state<SSEConnectionState>('disconnected');
	#lastEventAt = $state<number | null>(null);
	#eventCount = $state(0);
	#errorCount = $state(0);
	#unsubscribers: (() => void)[] = [];
	#customHandlers = new Map<string, Set<EventHandler>>();
	#initialized = false;

	constructor() {
		if (browser) {
			// Defer initialization to avoid SSR issues
			this.#scheduleInit();
		}
	}

	#scheduleInit() {
		// Use queueMicrotask to defer initialization
		queueMicrotask(() => {
			this.#init();
		});
	}

	#init() {
		if (this.#initialized || !browser) return;
		this.#initialized = true;

		const streamUrl = '/api/gastown/feed/stream';
		this.#stream = new ActivityStream(streamUrl, {
			reconnectDelay: 1000,
			maxReconnectDelay: 30000,
			reconnectMultiplier: 2
		});

		// Setup connection listeners
		this.#unsubscribers.push(
			this.#stream.onConnect(() => {
				this.#connectionState = 'connected';
				this.#errorCount = 0;
			})
		);

		this.#unsubscribers.push(
			this.#stream.onDisconnect(() => {
				if (this.#connectionState === 'connected') {
					this.#connectionState = 'reconnecting';
				}
			})
		);

		this.#unsubscribers.push(
			this.#stream.onError(() => {
				this.#errorCount++;
			})
		);

		// Setup event handlers for store invalidation
		this.#setupStoreHandlers();
	}

	#setupStoreHandlers() {
		if (!this.#stream) return;

		// Work events
		this.#unsubscribers.push(
			this.#stream.on('work_changed', (event) => {
				this.#handleEvent(event);
				workStore.invalidate();
				// If a specific ID was provided, also invalidate that item
				if (event.data?.id) {
					workStore.invalidateItem(event.data.id as string);
				}
			})
		);

		// Convoy events
		this.#unsubscribers.push(
			this.#stream.on('convoy_changed', (event) => {
				this.#handleEvent(event);
				convoysStore.invalidate();
				if (event.data?.id) {
					convoysStore.invalidateConvoy(event.data.id as string);
				}
			})
		);

		// Agent events
		this.#unsubscribers.push(
			this.#stream.on('agent_changed', (event) => {
				this.#handleEvent(event);
				agentsStore.invalidate();
				if (event.data?.id) {
					agentsStore.invalidateAgent(event.data.id as string);
				}
			})
		);

		// Mail events
		this.#unsubscribers.push(
			this.#stream.on('mail_changed', (event) => {
				this.#handleEvent(event);
				mailStore.invalidate();
				if (event.data?.id) {
					mailStore.invalidateItem(event.data.id as string);
				}
			})
		);

		// Rig events
		this.#unsubscribers.push(
			this.#stream.on('rig_changed', (event) => {
				this.#handleEvent(event);
				rigsStore.invalidate();
				if (event.data?.name) {
					rigsStore.invalidateRig(event.data.name as string);
				}
			})
		);

		// Queue events
		this.#unsubscribers.push(
			this.#stream.on('queue_changed', (event) => {
				this.#handleEvent(event);
				queueStore.invalidate();
				if (event.data?.rig) {
					queueStore.invalidateRig(event.data.rig as string);
				}
			})
		);

		// Wildcard for custom handlers
		this.#unsubscribers.push(
			this.#stream.on('*', (event) => {
				this.#dispatchToCustomHandlers('*', event);
				this.#dispatchToCustomHandlers(event.type, event);
			})
		);
	}

	#handleEvent(event: StreamEvent) {
		this.#lastEventAt = Date.now();
		this.#eventCount++;
	}

	#dispatchToCustomHandlers(eventType: string, event: StreamEvent) {
		const handlers = this.#customHandlers.get(eventType);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(event as SSEEvent);
				} catch (err) {
					console.error(`SSE handler error for ${eventType}:`, err);
				}
			}
		}
	}

	// Public getters
	get connectionState(): SSEConnectionState {
		return this.#connectionState;
	}

	get isConnected(): boolean {
		return this.#connectionState === 'connected';
	}

	get lastEventAt(): number | null {
		return this.#lastEventAt;
	}

	get eventCount(): number {
		return this.#eventCount;
	}

	get errorCount(): number {
		return this.#errorCount;
	}

	// Connect to SSE stream
	connect(): void {
		if (!browser || !this.#stream) {
			this.#init();
		}

		if (this.#connectionState === 'connected' || this.#connectionState === 'connecting') {
			return;
		}

		this.#connectionState = 'connecting';
		this.#stream?.connect();
	}

	// Disconnect from SSE stream
	disconnect(): void {
		this.#stream?.disconnect();
		this.#connectionState = 'disconnected';
	}

	// Subscribe to specific event types
	on(eventType: SSEEventType, handler: EventHandler): () => void {
		if (!this.#customHandlers.has(eventType)) {
			this.#customHandlers.set(eventType, new Set());
		}
		this.#customHandlers.get(eventType)!.add(handler);

		return () => {
			this.#customHandlers.get(eventType)?.delete(handler);
		};
	}

	// Unsubscribe from event type
	off(eventType: SSEEventType, handler?: EventHandler): void {
		if (handler) {
			this.#customHandlers.get(eventType)?.delete(handler);
		} else {
			this.#customHandlers.delete(eventType);
		}
	}

	// Manually trigger store invalidation
	invalidateAll(): void {
		workStore.invalidate();
		convoysStore.invalidate();
		agentsStore.invalidate();
		mailStore.invalidate();
		rigsStore.invalidate();
		queueStore.invalidate();
	}

	// Reset error count
	resetErrors(): void {
		this.#errorCount = 0;
	}

	// Cleanup
	destroy(): void {
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];

		this.#stream?.removeAllListeners();
		this.#stream?.disconnect();
		this.#stream = null;

		this.#customHandlers.clear();
		this.#initialized = false;
		this.#connectionState = 'disconnected';
	}
}

export const sseStore = new SSEStore();

export function useSSE() {
	return {
		get connectionState() {
			return sseStore.connectionState;
		},
		get isConnected() {
			return sseStore.isConnected;
		},
		get lastEventAt() {
			return sseStore.lastEventAt;
		},
		get eventCount() {
			return sseStore.eventCount;
		},
		get errorCount() {
			return sseStore.errorCount;
		},
		connect: () => sseStore.connect(),
		disconnect: () => sseStore.disconnect(),
		on: (eventType: SSEEventType, handler: EventHandler) => sseStore.on(eventType, handler),
		off: (eventType: SSEEventType, handler?: EventHandler) => sseStore.off(eventType, handler),
		invalidateAll: () => sseStore.invalidateAll(),
		resetErrors: () => sseStore.resetErrors()
	};
}
