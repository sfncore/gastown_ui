/**
 * Operations Store
 *
 * In-memory store for tracking long-running operations.
 */

export type OperationType = 'fetch' | 'rebase' | 'merge' | 'test' | 'deploy' | 'rig-add' | 'other';
export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Operation {
	id: string;
	type: OperationType;
	status: OperationStatus;
	startedAt: string;
	completedAt: string | null;
	progress: number;
	error: string | null;
	logs: string[];
	metadata: Record<string, unknown>;
}

class OperationsStore {
	private operations = new Map<string, Operation>();
	private cancelCallbacks = new Map<string, () => void>();

	generateId(): string {
		return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	create(type: OperationType, metadata: Record<string, unknown> = {}): Operation {
		const id = this.generateId();
		const operation: Operation = {
			id,
			type,
			status: 'pending',
			startedAt: new Date().toISOString(),
			completedAt: null,
			progress: 0,
			error: null,
			logs: [],
			metadata
		};

		this.operations.set(id, operation);
		return operation;
	}

	get(id: string): Operation | undefined {
		return this.operations.get(id);
	}

	list(filters?: { status?: OperationStatus; type?: OperationType }): Operation[] {
		let ops = Array.from(this.operations.values());

		if (filters?.status) {
			ops = ops.filter((op) => op.status === filters.status);
		}
		if (filters?.type) {
			ops = ops.filter((op) => op.type === filters.type);
		}

		return ops.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
	}

	update(id: string, updates: Partial<Pick<Operation, 'status' | 'progress' | 'error'>>): boolean {
		const op = this.operations.get(id);
		if (!op) return false;

		if (updates.status !== undefined) op.status = updates.status;
		if (updates.progress !== undefined) op.progress = updates.progress;
		if (updates.error !== undefined) op.error = updates.error;

		if (updates.status === 'completed' || updates.status === 'failed') {
			op.completedAt = new Date().toISOString();
		}

		return true;
	}

	appendLog(id: string, log: string): boolean {
		const op = this.operations.get(id);
		if (!op) return false;
		op.logs.push(log);
		return true;
	}

	setCancelCallback(id: string, callback: () => void): void {
		this.cancelCallbacks.set(id, callback);
	}

	cancel(id: string): { success: boolean; error?: string } {
		const op = this.operations.get(id);
		if (!op) {
			return { success: false, error: 'Operation not found' };
		}

		if (op.status !== 'pending' && op.status !== 'running') {
			return { success: false, error: `Cannot cancel operation in ${op.status} state` };
		}

		const callback = this.cancelCallbacks.get(id);
		if (callback) {
			callback();
			this.cancelCallbacks.delete(id);
		}

		op.status = 'cancelled';
		op.completedAt = new Date().toISOString();
		return { success: true };
	}

	cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
		const cutoff = Date.now() - maxAge;
		let removed = 0;

		for (const [id, op] of this.operations) {
			const timestamp = op.completedAt || op.startedAt;
			if (new Date(timestamp).getTime() < cutoff) {
				this.operations.delete(id);
				this.cancelCallbacks.delete(id);
				removed++;
			}
		}

		return removed;
	}
}

export const operationsStore = new OperationsStore();
