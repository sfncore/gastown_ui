/**
 * Operations store using Svelte 5 runes
 *
 * Manages Operation Center state including:
 * - Active operations tracking with progress
 * - System health metrics
 * - Recent activity feed
 * - Quick action buttons
 * - Overall system status
 */

import type { ComponentType } from 'svelte';

export interface OperationStatus {
	id: string;
	name: string;
	type: 'workflow' | 'convoy' | 'task';
	status: 'running' | 'paused' | 'pending' | 'completed' | 'error';
	progress: number;
	startedAt: string;
	estimatedCompletion?: string;
}

export interface QuickAction {
	id: string;
	label: string;
	icon: ComponentType;
	variant: 'primary' | 'secondary' | 'destructive';
	action: () => void;
	disabled?: boolean;
}

export interface SystemMetric {
	label: string;
	value: string | number;
	status: 'success' | 'warning' | 'error' | 'neutral';
	icon?: ComponentType;
}

export interface ActivityItem {
	id: string;
	message: string;
	timestamp: string;
	level: 'info' | 'success' | 'warning' | 'error';
}

export type SystemStatus = 'healthy' | 'degraded' | 'critical';

const MAX_ACTIVITIES = 50;

class OperationsStore {
	// Core state
	#operations = $state<OperationStatus[]>([]);
	#metrics = $state<SystemMetric[]>([]);
	#activities = $state<ActivityItem[]>([]);
	#actions = $state<QuickAction[]>([]);
	#systemStatus = $state<SystemStatus>('healthy');
	#loading = $state(false);

	// Public getters
	get operations() {
		return this.#operations;
	}

	get metrics() {
		return this.#metrics;
	}

	get activities() {
		return this.#activities;
	}

	get actions() {
		return this.#actions;
	}

	get systemStatus() {
		return this.#systemStatus;
	}

	get loading() {
		return this.#loading;
	}

	get activeOperationsCount() {
		return this.#operations.filter((op) => op.status === 'running').length;
	}

	get hasErrors() {
		return this.#operations.some((op) => op.status === 'error');
	}

	// Loading state management
	setLoading(loading: boolean) {
		this.#loading = loading;
	}

	// System status management
	setSystemStatus(status: SystemStatus) {
		this.#systemStatus = status;
	}

	// Operations management
	addOperation(operation: OperationStatus) {
		this.#operations = [...this.#operations, operation];
		this.#updateSystemStatus();
	}

	updateOperation(id: string, updates: Partial<OperationStatus>) {
		this.#operations = this.#operations.map((op) =>
			op.id === id ? { ...op, ...updates } : op
		);
		this.#updateSystemStatus();
	}

	removeOperation(id: string) {
		this.#operations = this.#operations.filter((op) => op.id !== id);
		this.#updateSystemStatus();
	}

	clearCompletedOperations() {
		this.#operations = this.#operations.filter(
			(op) => op.status !== 'completed' && op.status !== 'error'
		);
	}

	// Metrics management
	setMetrics(metrics: SystemMetric[]) {
		this.#metrics = metrics;
	}

	updateMetric(label: string, updates: Partial<SystemMetric>) {
		this.#metrics = this.#metrics.map((metric) =>
			metric.label === label ? { ...metric, ...updates } : metric
		);
	}

	// Activities management
	addActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>) {
		const newActivity: ActivityItem = {
			...activity,
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString()
		};

		// Add to front and limit total count
		this.#activities = [newActivity, ...this.#activities].slice(0, MAX_ACTIVITIES);
	}

	clearActivities() {
		this.#activities = [];
	}

	// Actions management
	setActions(actions: QuickAction[]) {
		this.#actions = actions;
	}

	addAction(action: QuickAction) {
		this.#actions = [...this.#actions, action];
	}

	removeAction(id: string) {
		this.#actions = this.#actions.filter((action) => action.id !== id);
	}

	updateAction(id: string, updates: Partial<QuickAction>) {
		this.#actions = this.#actions.map((action) =>
			action.id === id ? { ...action, ...updates } : action
		);
	}

	// Auto-update system status based on operations
	#updateSystemStatus() {
		const hasErrors = this.#operations.some((op) => op.status === 'error');
		const hasPaused = this.#operations.some((op) => op.status === 'paused');

		if (hasErrors) {
			this.#systemStatus = 'critical';
		} else if (hasPaused) {
			this.#systemStatus = 'degraded';
		} else {
			this.#systemStatus = 'healthy';
		}
	}

	// Bulk update for data refresh
	updateAll(data: {
		operations?: OperationStatus[];
		metrics?: SystemMetric[];
		activities?: ActivityItem[];
		actions?: QuickAction[];
		systemStatus?: SystemStatus;
	}) {
		if (data.operations !== undefined) {
			this.#operations = data.operations;
		}
		if (data.metrics !== undefined) {
			this.#metrics = data.metrics;
		}
		if (data.activities !== undefined) {
			this.#activities = data.activities;
		}
		if (data.actions !== undefined) {
			this.#actions = data.actions;
		}
		if (data.systemStatus !== undefined) {
			this.#systemStatus = data.systemStatus;
		} else {
			this.#updateSystemStatus();
		}
	}

	// Reset to initial state
	reset() {
		this.#operations = [];
		this.#metrics = [];
		this.#activities = [];
		this.#actions = [];
		this.#systemStatus = 'healthy';
		this.#loading = false;
	}
}

// Singleton instance
export const operationsStore = new OperationsStore();
