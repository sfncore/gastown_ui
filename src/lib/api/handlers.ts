/**
 * Real-time event handlers for Gas Town daemon WebSocket messages
 *
 * Provides:
 * - Agent status updates
 * - Log stream processing
 * - Queue update handling
 * - Workflow progress tracking
 * - Optimistic UI update patterns
 */

import {
	wsClient,
	type AgentStatusPayload,
	type LogEntryPayload,
	type QueueUpdatePayload,
	type WorkflowUpdatePayload
} from '$lib/stores';

// Browser detection
const browser = typeof window !== 'undefined';

// State types for stores
export interface Agent {
	id: string;
	name: string;
	status: 'idle' | 'working' | 'error' | 'offline';
	currentTask?: string;
	lastSeen: number;
}

export interface LogEntry {
	id: string;
	agentId: string;
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	timestamp: number;
}

export interface QueueItem {
	id: string;
	type: string;
	priority: number;
	createdAt: number;
	data?: unknown;
}

export interface WorkflowStep {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	startedAt?: number;
	completedAt?: number;
}

export interface Workflow {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	steps: WorkflowStep[];
	currentStep?: string;
	startedAt?: number;
	completedAt?: number;
	error?: string;
}

// Optimistic update tracking
interface OptimisticUpdate<T> {
	id: string;
	type: 'create' | 'update' | 'delete';
	data: T;
	timestamp: number;
	rollback: () => void;
}

// Handler callback types
type AgentHandler = (agents: Map<string, Agent>) => void;
type LogHandler = (logs: LogEntry[]) => void;
type QueueHandler = (items: QueueItem[]) => void;
type WorkflowHandler = (workflows: Map<string, Workflow>) => void;

class RealtimeHandlers {
	// Internal state
	#agents = new Map<string, Agent>();
	#logs: LogEntry[] = [];
	#queue: QueueItem[] = [];
	#workflows = new Map<string, Workflow>();

	// Optimistic updates pending confirmation
	#pendingUpdates = new Map<string, OptimisticUpdate<unknown>>();

	// Handler subscriptions
	#agentHandlers: AgentHandler[] = [];
	#logHandlers: LogHandler[] = [];
	#queueHandlers: QueueHandler[] = [];
	#workflowHandlers: WorkflowHandler[] = [];

	// Configuration
	#maxLogs = 1000;
	#optimisticTimeout = 5000;

	// Unsubscribe functions
	#unsubscribers: (() => void)[] = [];
	#initialized = false;
	#cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		if (browser) {
			this.#init();
		}
	}

	#init() {
		if (this.#initialized) return;
		this.#initialized = true;

		// Subscribe to WebSocket message types
		this.#unsubscribers.push(
			wsClient.on<AgentStatusPayload>('agent_status', this.#handleAgentStatus),
			wsClient.on<LogEntryPayload>('log_entry', this.#handleLogEntry),
			wsClient.on<QueueUpdatePayload>('queue_update', this.#handleQueueUpdate),
			wsClient.on<WorkflowUpdatePayload>('workflow_update', this.#handleWorkflowUpdate)
		);

		// Clear stale optimistic updates periodically
		if (browser) {
			this.#cleanupInterval = setInterval(() => this.#clearStaleOptimisticUpdates(), 1000);
		}
	}

	// Public getters
	get agents() {
		return new Map(this.#agents);
	}

	get logs() {
		return [...this.#logs];
	}

	get queue() {
		return [...this.#queue];
	}

	get workflows() {
		return new Map(this.#workflows);
	}

	// Subscribe to state changes
	onAgentChange(handler: AgentHandler): () => void {
		this.#agentHandlers.push(handler);
		handler(this.agents); // Immediate callback with current state
		return () => {
			const idx = this.#agentHandlers.indexOf(handler);
			if (idx > -1) this.#agentHandlers.splice(idx, 1);
		};
	}

	onLogChange(handler: LogHandler): () => void {
		this.#logHandlers.push(handler);
		handler(this.logs);
		return () => {
			const idx = this.#logHandlers.indexOf(handler);
			if (idx > -1) this.#logHandlers.splice(idx, 1);
		};
	}

	onQueueChange(handler: QueueHandler): () => void {
		this.#queueHandlers.push(handler);
		handler(this.queue);
		return () => {
			const idx = this.#queueHandlers.indexOf(handler);
			if (idx > -1) this.#queueHandlers.splice(idx, 1);
		};
	}

	onWorkflowChange(handler: WorkflowHandler): () => void {
		this.#workflowHandlers.push(handler);
		handler(this.workflows);
		return () => {
			const idx = this.#workflowHandlers.indexOf(handler);
			if (idx > -1) this.#workflowHandlers.splice(idx, 1);
		};
	}

	// Optimistic updates - apply immediately, rollback on failure
	optimisticAgentUpdate(agentId: string, update: Partial<Agent>): string {
		const updateId = crypto.randomUUID();
		const current = this.#agents.get(agentId);

		if (!current) return updateId;

		const original = { ...current };
		const updated = { ...current, ...update };

		this.#agents.set(agentId, updated);
		this.#notifyAgentHandlers();

		this.#pendingUpdates.set(updateId, {
			id: updateId,
			type: 'update',
			data: { agentId, original },
			timestamp: Date.now(),
			rollback: () => {
				this.#agents.set(agentId, original);
				this.#notifyAgentHandlers();
			}
		});

		return updateId;
	}

	optimisticQueueAdd(item: Omit<QueueItem, 'id' | 'createdAt'>): string {
		const updateId = crypto.randomUUID();
		const newItem: QueueItem = {
			...item,
			id: updateId,
			createdAt: Date.now()
		};

		this.#queue = [...this.#queue, newItem];
		this.#notifyQueueHandlers();

		this.#pendingUpdates.set(updateId, {
			id: updateId,
			type: 'create',
			data: newItem,
			timestamp: Date.now(),
			rollback: () => {
				this.#queue = this.#queue.filter((i) => i.id !== updateId);
				this.#notifyQueueHandlers();
			}
		});

		return updateId;
	}

	optimisticQueueRemove(itemId: string): string {
		const updateId = crypto.randomUUID();
		const item = this.#queue.find((i) => i.id === itemId);

		if (!item) return updateId;

		const originalIndex = this.#queue.indexOf(item);
		this.#queue = this.#queue.filter((i) => i.id !== itemId);
		this.#notifyQueueHandlers();

		this.#pendingUpdates.set(updateId, {
			id: updateId,
			type: 'delete',
			data: { item, index: originalIndex },
			timestamp: Date.now(),
			rollback: () => {
				const newQueue = [...this.#queue];
				newQueue.splice(originalIndex, 0, item);
				this.#queue = newQueue;
				this.#notifyQueueHandlers();
			}
		});

		return updateId;
	}

	// Confirm or rollback optimistic updates
	confirmUpdate(updateId: string) {
		this.#pendingUpdates.delete(updateId);
	}

	rollbackUpdate(updateId: string) {
		const update = this.#pendingUpdates.get(updateId);
		if (update) {
			update.rollback();
			this.#pendingUpdates.delete(updateId);
		}
	}

	// Clear all state
	reset() {
		this.#agents.clear();
		this.#logs = [];
		this.#queue = [];
		this.#workflows.clear();
		this.#pendingUpdates.clear();

		this.#notifyAgentHandlers();
		this.#notifyLogHandlers();
		this.#notifyQueueHandlers();
		this.#notifyWorkflowHandlers();
	}

	// Cleanup
	destroy() {
		// Clear the cleanup interval
		if (this.#cleanupInterval) {
			clearInterval(this.#cleanupInterval);
			this.#cleanupInterval = null;
		}

		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
		this.#agentHandlers = [];
		this.#logHandlers = [];
		this.#queueHandlers = [];
		this.#workflowHandlers = [];
		this.#initialized = false;
	}

	// Private message handlers
	#handleAgentStatus = (payload: AgentStatusPayload) => {
		const existing = this.#agents.get(payload.agentId);

		const agent: Agent = {
			id: payload.agentId,
			name: existing?.name || payload.agentId,
			status: payload.status,
			currentTask: payload.currentTask,
			lastSeen: Date.now()
		};

		this.#agents.set(payload.agentId, agent);
		this.#notifyAgentHandlers();
	};

	#handleLogEntry = (payload: LogEntryPayload) => {
		const entry: LogEntry = {
			id: crypto.randomUUID(),
			agentId: payload.agentId,
			level: payload.level,
			message: payload.message,
			timestamp: payload.timestamp
		};

		// Add to front, maintain max size
		this.#logs = [entry, ...this.#logs.slice(0, this.#maxLogs - 1)];
		this.#notifyLogHandlers();
	};

	#handleQueueUpdate = (payload: QueueUpdatePayload) => {
		switch (payload.action) {
			case 'added':
				if (payload.item) {
					const newItem = payload.item as QueueItem;
					// Check if this confirms an optimistic add
					const pending = Array.from(this.#pendingUpdates.values()).find(
						(u) => u.type === 'create' && (u.data as QueueItem).id === newItem.id
					);
					if (pending) {
						this.confirmUpdate(pending.id);
					} else {
						this.#queue = [...this.#queue, newItem];
					}
				}
				break;

			case 'removed':
				// Check if this confirms an optimistic remove
				const pendingRemove = Array.from(this.#pendingUpdates.values()).find(
					(u) =>
						u.type === 'delete' &&
						(u.data as { item: QueueItem }).item.id === payload.queueId
				);
				if (pendingRemove) {
					this.confirmUpdate(pendingRemove.id);
				} else {
					this.#queue = this.#queue.filter((i) => i.id !== payload.queueId);
				}
				break;

			case 'updated':
				if (payload.item) {
					const idx = this.#queue.findIndex((i) => i.id === payload.queueId);
					if (idx > -1) {
						this.#queue = [
							...this.#queue.slice(0, idx),
							payload.item as QueueItem,
							...this.#queue.slice(idx + 1)
						];
					}
				}
				break;
		}

		this.#notifyQueueHandlers();
	};

	#handleWorkflowUpdate = (payload: WorkflowUpdatePayload) => {
		const existing = this.#workflows.get(payload.workflowId);

		switch (payload.status) {
			case 'started':
				this.#workflows.set(payload.workflowId, {
					id: payload.workflowId,
					name: existing?.name || payload.workflowId,
					status: 'running',
					steps: existing?.steps || [],
					startedAt: Date.now()
				});
				break;

			case 'step_completed':
				if (existing && payload.step) {
					const steps = existing.steps.map((s) =>
						s.id === payload.step
							? { ...s, status: 'completed' as const, completedAt: Date.now() }
							: s
					);
					this.#workflows.set(payload.workflowId, {
						...existing,
						steps,
						currentStep: payload.step
					});
				}
				break;

			case 'completed':
				if (existing) {
					this.#workflows.set(payload.workflowId, {
						...existing,
						status: 'completed',
						completedAt: Date.now()
					});
				}
				break;

			case 'failed':
				if (existing) {
					this.#workflows.set(payload.workflowId, {
						...existing,
						status: 'failed',
						error: payload.error,
						completedAt: Date.now()
					});
				}
				break;
		}

		this.#notifyWorkflowHandlers();
	};

	// Notification helpers
	#notifyAgentHandlers() {
		const snapshot = this.agents;
		for (const handler of this.#agentHandlers) {
			try {
				handler(snapshot);
			} catch (e) {
				console.error('Agent handler error:', e);
			}
		}
	}

	#notifyLogHandlers() {
		const snapshot = this.logs;
		for (const handler of this.#logHandlers) {
			try {
				handler(snapshot);
			} catch (e) {
				console.error('Log handler error:', e);
			}
		}
	}

	#notifyQueueHandlers() {
		const snapshot = this.queue;
		for (const handler of this.#queueHandlers) {
			try {
				handler(snapshot);
			} catch (e) {
				console.error('Queue handler error:', e);
			}
		}
	}

	#notifyWorkflowHandlers() {
		const snapshot = this.workflows;
		for (const handler of this.#workflowHandlers) {
			try {
				handler(snapshot);
			} catch (e) {
				console.error('Workflow handler error:', e);
			}
		}
	}

	#clearStaleOptimisticUpdates() {
		const now = Date.now();
		for (const [id, update] of this.#pendingUpdates) {
			if (now - update.timestamp > this.#optimisticTimeout) {
				update.rollback();
				this.#pendingUpdates.delete(id);
				console.warn('Optimistic update timed out, rolled back:', id);
			}
		}
	}
}

// Singleton instance
export const realtimeHandlers = new RealtimeHandlers();

// Helper functions for common patterns
export function getAgentById(agentId: string): Agent | undefined {
	return realtimeHandlers.agents.get(agentId);
}

export function getLogsByAgent(agentId: string): LogEntry[] {
	return realtimeHandlers.logs.filter((log) => log.agentId === agentId);
}

export function getLogsByLevel(level: LogEntry['level']): LogEntry[] {
	return realtimeHandlers.logs.filter((log) => log.level === level);
}

export function getWorkflowById(workflowId: string): Workflow | undefined {
	return realtimeHandlers.workflows.get(workflowId);
}

export function getActiveWorkflows(): Workflow[] {
	return Array.from(realtimeHandlers.workflows.values()).filter(
		(w) => w.status === 'running'
	);
}
