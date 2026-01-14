/**
 * Operations Store - Track and manage long-running operations
 *
 * Provides centralized tracking for:
 * - Background tasks (builds, deployments, data processing)
 * - API requests with progress
 * - Multi-step workflows
 * - Batch operations
 * - Operation cancellation and retry
 */

import { toastStore } from './toast.svelte';

const browser = typeof window !== 'undefined';

/** Operation status states */
export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Operation priority levels */
export type OperationPriority = 'low' | 'normal' | 'high' | 'critical';

/** Operation types for categorization */
export type OperationType =
	| 'api'
	| 'build'
	| 'deploy'
	| 'sync'
	| 'export'
	| 'import'
	| 'batch'
	| 'workflow'
	| 'custom';

/** Single operation tracked by the store */
export interface Operation {
	id: string;
	type: OperationType;
	name: string;
	description?: string;
	status: OperationStatus;
	priority: OperationPriority;
	progress: number; // 0-100
	startedAt: number;
	completedAt?: number;
	duration?: number;
	error?: Error;
	metadata?: Record<string, unknown>;
	parentId?: string;
	cancellable?: boolean;
	onCancel?: () => void | Promise<void>;
}

/** Operation group for related operations */
export interface OperationGroup {
	id: string;
	name: string;
	operations: string[]; // Operation IDs
	progress: number; // Computed from child operations
	status: OperationStatus; // Computed from child operations
}

/** Configuration for creating a new operation */
export interface CreateOperationConfig {
	type: OperationType;
	name: string;
	description?: string;
	priority?: OperationPriority;
	parentId?: string;
	metadata?: Record<string, unknown>;
	cancellable?: boolean;
	onCancel?: () => void | Promise<void>;
	showToast?: boolean;
}

/** Options for operation updates */
export interface UpdateOperationOptions {
	progress?: number;
	description?: string;
	metadata?: Record<string, unknown>;
}

class OperationsStore {
	#operations = new Map<string, Operation>();
	#groups = new Map<string, OperationGroup>();
	#history: Operation[] = [];
	#maxHistory = 50;

	// Reactive state
	#activeCount = $state(0);
	#totalProgress = $state(0);
	#hasRunning = $state(false);

	constructor() {
		if (browser) {
			this.#init();
		}
	}

	#init() {
		// Periodic cleanup of old completed operations
		if (browser) {
			setInterval(() => this.#cleanupOld(), 60000); // Every minute
		}
	}

	// Public getters
	get activeCount() {
		return this.#activeCount;
	}

	get totalProgress() {
		return this.#totalProgress;
	}

	get hasRunning() {
		return this.#hasRunning;
	}

	get operations(): Operation[] {
		return Array.from(this.#operations.values());
	}

	get runningOperations(): Operation[] {
		return this.operations.filter((op) => op.status === 'running');
	}

	get pendingOperations(): Operation[] {
		return this.operations.filter((op) => op.status === 'pending');
	}

	get completedOperations(): Operation[] {
		return this.operations.filter((op) => op.status === 'completed');
	}

	get failedOperations(): Operation[] {
		return this.operations.filter((op) => op.status === 'failed');
	}

	get history(): Operation[] {
		return [...this.#history];
	}

	/**
	 * Create and start a new operation
	 */
	create(config: CreateOperationConfig): string {
		const id = crypto.randomUUID();
		const operation: Operation = {
			id,
			type: config.type,
			name: config.name,
			description: config.description,
			status: 'pending',
			priority: config.priority || 'normal',
			progress: 0,
			startedAt: Date.now(),
			metadata: config.metadata,
			parentId: config.parentId,
			cancellable: config.cancellable,
			onCancel: config.onCancel
		};

		this.#operations.set(id, operation);
		this.#updateMetrics();

		// Show toast if requested
		if (config.showToast) {
			toastStore.info(`Started: ${config.name}`, {
				duration: 3000
			});
		}

		// Auto-start if not part of a group
		if (!config.parentId) {
			this.start(id);
		}

		return id;
	}

	/**
	 * Start a pending operation
	 */
	start(id: string): boolean {
		const operation = this.#operations.get(id);
		if (!operation || operation.status !== 'pending') {
			return false;
		}

		operation.status = 'running';
		operation.startedAt = Date.now();
		this.#operations.set(id, operation);
		this.#updateMetrics();

		return true;
	}

	/**
	 * Update operation progress and metadata
	 */
	update(id: string, options: UpdateOperationOptions): boolean {
		const operation = this.#operations.get(id);
		if (!operation) {
			return false;
		}

		if (options.progress !== undefined) {
			operation.progress = Math.max(0, Math.min(100, options.progress));
		}

		if (options.description !== undefined) {
			operation.description = options.description;
		}

		if (options.metadata !== undefined) {
			operation.metadata = { ...operation.metadata, ...options.metadata };
		}

		this.#operations.set(id, operation);
		this.#updateMetrics();

		return true;
	}

	/**
	 * Complete an operation successfully
	 */
	complete(id: string, metadata?: Record<string, unknown>): boolean {
		const operation = this.#operations.get(id);
		if (!operation) {
			return false;
		}

		operation.status = 'completed';
		operation.progress = 100;
		operation.completedAt = Date.now();
		operation.duration = operation.completedAt - operation.startedAt;

		if (metadata) {
			operation.metadata = { ...operation.metadata, ...metadata };
		}

		this.#operations.set(id, operation);
		this.#addToHistory(operation);
		this.#updateMetrics();

		// Auto-remove after delay
		setTimeout(() => this.remove(id), 5000);

		return true;
	}

	/**
	 * Fail an operation
	 */
	fail(id: string, error: Error | string, metadata?: Record<string, unknown>): boolean {
		const operation = this.#operations.get(id);
		if (!operation) {
			return false;
		}

		operation.status = 'failed';
		operation.completedAt = Date.now();
		operation.duration = operation.completedAt - operation.startedAt;
		operation.error = typeof error === 'string' ? new Error(error) : error;

		if (metadata) {
			operation.metadata = { ...operation.metadata, ...metadata };
		}

		this.#operations.set(id, operation);
		this.#addToHistory(operation);
		this.#updateMetrics();

		// Show error toast
		toastStore.error(`Failed: ${operation.name} - ${operation.error.message}`, {
			duration: 5000
		});

		// Auto-remove failed operations after longer delay
		setTimeout(() => this.remove(id), 10000);

		return true;
	}

	/**
	 * Cancel an operation
	 */
	async cancel(id: string): Promise<boolean> {
		const operation = this.#operations.get(id);
		if (!operation || !operation.cancellable) {
			return false;
		}

		// Call cancel handler if provided
		if (operation.onCancel) {
			try {
				await operation.onCancel();
			} catch (error) {
				console.error('Operation cancel handler failed:', error);
			}
		}

		operation.status = 'cancelled';
		operation.completedAt = Date.now();
		operation.duration = operation.completedAt - operation.startedAt;

		this.#operations.set(id, operation);
		this.#addToHistory(operation);
		this.#updateMetrics();

		toastStore.info(`Cancelled: ${operation.name}`, {
			duration: 3000
		});

		// Auto-remove
		setTimeout(() => this.remove(id), 3000);

		return true;
	}

	/**
	 * Remove an operation from active list
	 */
	remove(id: string): boolean {
		if (!this.#operations.has(id)) {
			return false;
		}

		this.#operations.delete(id);
		this.#updateMetrics();

		return true;
	}

	/**
	 * Get a specific operation
	 */
	get(id: string): Operation | undefined {
		return this.#operations.get(id);
	}

	/**
	 * Create a group of related operations
	 */
	createGroup(name: string, operationIds: string[]): string {
		const id = crypto.randomUUID();
		const group: OperationGroup = {
			id,
			name,
			operations: operationIds,
			progress: 0,
			status: 'pending'
		};

		this.#groups.set(id, group);
		this.#updateGroupMetrics(id);

		return id;
	}

	/**
	 * Get operations in a group
	 */
	getGroupOperations(groupId: string): Operation[] {
		const group = this.#groups.get(groupId);
		if (!group) return [];

		return group.operations.map((opId) => this.#operations.get(opId)).filter((op): op is Operation => !!op);
	}

	/**
	 * Clear all completed operations
	 */
	clearCompleted(): void {
		for (const [id, operation] of this.#operations) {
			if (operation.status === 'completed') {
				this.#operations.delete(id);
			}
		}
		this.#updateMetrics();
	}

	/**
	 * Clear all operations (use with caution)
	 */
	clearAll(): void {
		this.#operations.clear();
		this.#groups.clear();
		this.#updateMetrics();
	}

	/**
	 * Clear operation history
	 */
	clearHistory(): void {
		this.#history = [];
	}

	// Private methods

	#updateMetrics(): void {
		const ops = Array.from(this.#operations.values());

		this.#activeCount = ops.filter((op) => op.status === 'running' || op.status === 'pending').length;

		this.#hasRunning = ops.some((op) => op.status === 'running');

		// Calculate total progress (average of running operations)
		const runningOps = ops.filter((op) => op.status === 'running');
		if (runningOps.length > 0) {
			const totalProgress = runningOps.reduce((sum, op) => sum + op.progress, 0);
			this.#totalProgress = Math.round(totalProgress / runningOps.length);
		} else {
			this.#totalProgress = 0;
		}
	}

	#updateGroupMetrics(groupId: string): void {
		const group = this.#groups.get(groupId);
		if (!group) return;

		const operations = this.getGroupOperations(groupId);
		if (operations.length === 0) return;

		// Calculate group progress
		const totalProgress = operations.reduce((sum, op) => sum + op.progress, 0);
		group.progress = Math.round(totalProgress / operations.length);

		// Calculate group status
		const allCompleted = operations.every((op) => op.status === 'completed');
		const anyFailed = operations.some((op) => op.status === 'failed');
		const anyRunning = operations.some((op) => op.status === 'running');

		if (allCompleted) {
			group.status = 'completed';
		} else if (anyFailed) {
			group.status = 'failed';
		} else if (anyRunning) {
			group.status = 'running';
		} else {
			group.status = 'pending';
		}

		this.#groups.set(groupId, group);
	}

	#addToHistory(operation: Operation): void {
		this.#history = [operation, ...this.#history].slice(0, this.#maxHistory);
	}

	#cleanupOld(): void {
		const now = Date.now();
		const maxAge = 5 * 60 * 1000; // 5 minutes

		for (const [id, operation] of this.#operations) {
			if (operation.status === 'completed' && operation.completedAt) {
				if (now - operation.completedAt > maxAge) {
					this.#operations.delete(id);
				}
			}
		}

		this.#updateMetrics();
	}
}

// Singleton instance
export const operationsStore = new OperationsStore();

/**
 * Helper hook for tracking an async operation
 *
 * @example
 * const operationId = operationsStore.create({
 *   type: 'api',
 *   name: 'Fetching agents',
 *   showToast: true
 * });
 *
 * try {
 *   const data = await fetchData();
 *   operationsStore.complete(operationId);
 * } catch (error) {
 *   operationsStore.fail(operationId, error);
 * }
 */
export function trackOperation<T>(
	config: CreateOperationConfig,
	operation: (updateProgress: (progress: number) => void) => Promise<T>
): Promise<T> {
	const id = operationsStore.create(config);

	const updateProgress = (progress: number) => {
		operationsStore.update(id, { progress });
	};

	return operation(updateProgress)
		.then((result) => {
			operationsStore.complete(id);
			return result;
		})
		.catch((error) => {
			operationsStore.fail(id, error);
			throw error;
		});
}

/**
 * Helper for batch operations
 */
export async function trackBatchOperation<T>(
	items: T[],
	config: Omit<CreateOperationConfig, 'type'>,
	processor: (item: T, index: number) => Promise<void>
): Promise<void> {
	const groupName = config.name;
	const operationIds: string[] = [];

	// Create operations for each item
	items.forEach((_, index) => {
		const opId = operationsStore.create({
			...config,
			type: 'batch',
			name: `${groupName} (${index + 1}/${items.length})`,
			showToast: false
		});
		operationIds.push(opId);
	});

	// Create group
	const groupId = operationsStore.createGroup(groupName, operationIds);

	// Process items
	for (let i = 0; i < items.length; i++) {
		const opId = operationIds[i];
		operationsStore.start(opId);

		try {
			await processor(items[i], i);
			operationsStore.complete(opId);
		} catch (error) {
			operationsStore.fail(opId, error as Error);
		}
	}

	return Promise.resolve();
}
