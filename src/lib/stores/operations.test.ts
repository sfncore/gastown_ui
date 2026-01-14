import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	operationsStore,
	trackOperation,
	trackBatchOperation,
	type CreateOperationConfig
} from './operations.svelte';

// Mock toast store
vi.mock('./toast.svelte', () => ({
	toastStore: {
		info: vi.fn(),
		error: vi.fn(),
		success: vi.fn()
	}
}));

describe('Operations Store', () => {
	beforeEach(() => {
		operationsStore.clearAll();
		operationsStore.clearHistory();
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('create()', () => {
		it('creates a new operation', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Test Operation',
				description: 'A test operation'
			});

			expect(id).toBeTruthy();

			const operation = operationsStore.get(id);
			expect(operation).toBeDefined();
			expect(operation?.name).toBe('Test Operation');
			expect(operation?.type).toBe('api');
			expect(operation?.status).toBe('pending');
			expect(operation?.progress).toBe(0);
		});

		it('auto-starts operation if not part of a group', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Auto-start Operation'
			});

			// Should advance to running after creation
			const operation = operationsStore.get(id);
			expect(operation?.status).toBe('running');
		});

		it('does not auto-start if parentId is specified', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Child Operation',
				parentId: 'parent-123'
			});

			const operation = operationsStore.get(id);
			expect(operation?.status).toBe('pending');
		});

		it('sets default priority to normal', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			const operation = operationsStore.get(id);
			expect(operation?.priority).toBe('normal');
		});

		it('accepts custom priority', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'High Priority Operation',
				priority: 'high'
			});

			const operation = operationsStore.get(id);
			expect(operation?.priority).toBe('high');
		});
	});

	describe('start()', () => {
		it('starts a pending operation', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				parentId: 'parent' // Prevents auto-start
			});

			expect(operationsStore.get(id)?.status).toBe('pending');

			const success = operationsStore.start(id);
			expect(success).toBe(true);
			expect(operationsStore.get(id)?.status).toBe('running');
		});

		it('returns false for non-pending operations', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.complete(id);

			const success = operationsStore.start(id);
			expect(success).toBe(false);
		});
	});

	describe('update()', () => {
		it('updates operation progress', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.update(id, { progress: 50 });
			expect(operationsStore.get(id)?.progress).toBe(50);

			operationsStore.update(id, { progress: 75 });
			expect(operationsStore.get(id)?.progress).toBe(75);
		});

		it('clamps progress between 0-100', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.update(id, { progress: 150 });
			expect(operationsStore.get(id)?.progress).toBe(100);

			operationsStore.update(id, { progress: -10 });
			expect(operationsStore.get(id)?.progress).toBe(0);
		});

		it('updates description', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				description: 'Initial'
			});

			operationsStore.update(id, { description: 'Updated description' });
			expect(operationsStore.get(id)?.description).toBe('Updated description');
		});

		it('updates metadata', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				metadata: { step: 1 }
			});

			operationsStore.update(id, { metadata: { step: 2, total: 5 } });

			const operation = operationsStore.get(id);
			expect(operation?.metadata).toEqual({ step: 2, total: 5 });
		});
	});

	describe('complete()', () => {
		it('marks operation as completed', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			const success = operationsStore.complete(id);
			expect(success).toBe(true);

			const operation = operationsStore.get(id);
			expect(operation?.status).toBe('completed');
			expect(operation?.progress).toBe(100);
			expect(operation?.completedAt).toBeDefined();
			expect(operation?.duration).toBeDefined();
		});

		it('adds completed operation to history', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.complete(id);

			const history = operationsStore.history;
			expect(history.length).toBe(1);
			expect(history[0].id).toBe(id);
		});

		it('auto-removes operation after delay', async () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.complete(id);
			expect(operationsStore.get(id)).toBeDefined();

			// Fast-forward time
			vi.advanceTimersByTime(6000);

			expect(operationsStore.get(id)).toBeUndefined();
		});
	});

	describe('fail()', () => {
		it('marks operation as failed with error', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			const error = new Error('Test error');
			const success = operationsStore.fail(id, error);
			expect(success).toBe(true);

			const operation = operationsStore.get(id);
			expect(operation?.status).toBe('failed');
			expect(operation?.error).toBe(error);
			expect(operation?.completedAt).toBeDefined();
			expect(operation?.duration).toBeDefined();
		});

		it('accepts error as string', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.fail(id, 'Error message');

			const operation = operationsStore.get(id);
			expect(operation?.error?.message).toBe('Error message');
		});

		it('adds failed operation to history', () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation'
			});

			operationsStore.fail(id, 'Error');

			const history = operationsStore.history;
			expect(history.length).toBe(1);
			expect(history[0].status).toBe('failed');
		});
	});

	describe('cancel()', () => {
		it('cancels a cancellable operation', async () => {
			const onCancel = vi.fn();
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				cancellable: true,
				onCancel
			});

			const success = await operationsStore.cancel(id);
			expect(success).toBe(true);

			const operation = operationsStore.get(id);
			expect(operation?.status).toBe('cancelled');
			expect(onCancel).toHaveBeenCalled();
		});

		it('rejects cancellation of non-cancellable operation', async () => {
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				cancellable: false
			});

			const success = await operationsStore.cancel(id);
			expect(success).toBe(false);
		});

		it('handles async cancel handlers', async () => {
			const onCancel = vi.fn().mockResolvedValue(undefined);
			const id = operationsStore.create({
				type: 'api',
				name: 'Operation',
				cancellable: true,
				onCancel
			});

			await operationsStore.cancel(id);

			expect(onCancel).toHaveBeenCalled();
		});
	});

	describe('metrics', () => {
		it('tracks active count', () => {
			expect(operationsStore.activeCount).toBe(0);

			const id1 = operationsStore.create({ type: 'api', name: 'Op 1' });
			expect(operationsStore.activeCount).toBe(1);

			const id2 = operationsStore.create({ type: 'api', name: 'Op 2' });
			expect(operationsStore.activeCount).toBe(2);

			operationsStore.complete(id1);
			expect(operationsStore.activeCount).toBe(1);

			operationsStore.complete(id2);
			expect(operationsStore.activeCount).toBe(0);
		});

		it('calculates total progress from running operations', () => {
			const id1 = operationsStore.create({ type: 'api', name: 'Op 1' });
			const id2 = operationsStore.create({ type: 'api', name: 'Op 2' });

			operationsStore.update(id1, { progress: 50 });
			operationsStore.update(id2, { progress: 100 });

			// Average: (50 + 100) / 2 = 75
			expect(operationsStore.totalProgress).toBe(75);
		});

		it('sets hasRunning flag correctly', () => {
			expect(operationsStore.hasRunning).toBe(false);

			const id = operationsStore.create({ type: 'api', name: 'Op' });
			expect(operationsStore.hasRunning).toBe(true);

			operationsStore.complete(id);
			expect(operationsStore.hasRunning).toBe(false);
		});
	});

	describe('groups', () => {
		it('creates operation groups', () => {
			const id1 = operationsStore.create({
				type: 'api',
				name: 'Op 1',
				parentId: 'group'
			});
			const id2 = operationsStore.create({
				type: 'api',
				name: 'Op 2',
				parentId: 'group'
			});

			const groupId = operationsStore.createGroup('My Group', [id1, id2]);
			expect(groupId).toBeTruthy();

			const groupOps = operationsStore.getGroupOperations(groupId);
			expect(groupOps).toHaveLength(2);
			expect(groupOps[0].id).toBe(id1);
			expect(groupOps[1].id).toBe(id2);
		});
	});

	describe('cleanup', () => {
		it('clears completed operations', () => {
			const id1 = operationsStore.create({ type: 'api', name: 'Op 1' });
			const id2 = operationsStore.create({ type: 'api', name: 'Op 2' });
			const id3 = operationsStore.create({ type: 'api', name: 'Op 3' });

			operationsStore.complete(id1);
			operationsStore.complete(id2);
			// id3 still running

			expect(operationsStore.operations).toHaveLength(3);

			operationsStore.clearCompleted();

			// Only running operation should remain
			const remaining = operationsStore.operations;
			expect(remaining).toHaveLength(1);
			expect(remaining[0].id).toBe(id3);
		});

		it('clears all operations', () => {
			operationsStore.create({ type: 'api', name: 'Op 1' });
			operationsStore.create({ type: 'api', name: 'Op 2' });

			expect(operationsStore.operations).toHaveLength(2);

			operationsStore.clearAll();

			expect(operationsStore.operations).toHaveLength(0);
			expect(operationsStore.activeCount).toBe(0);
		});

		it('clears history', () => {
			const id = operationsStore.create({ type: 'api', name: 'Op' });
			operationsStore.complete(id);

			expect(operationsStore.history).toHaveLength(1);

			operationsStore.clearHistory();

			expect(operationsStore.history).toHaveLength(0);
		});
	});

	describe('helpers', () => {
		it('trackOperation helper tracks async operation', async () => {
			const mockFn = vi.fn().mockResolvedValue('result');

			const result = await trackOperation(
				{
					type: 'api',
					name: 'Async Operation'
				},
				async (updateProgress) => {
					updateProgress(50);
					return mockFn();
				}
			);

			expect(result).toBe('result');
			expect(mockFn).toHaveBeenCalled();

			// Operation should be completed
			const completed = operationsStore.completedOperations;
			expect(completed).toHaveLength(1);
			expect(completed[0].name).toBe('Async Operation');
		});

		it('trackOperation marks operation as failed on error', async () => {
			const error = new Error('Test error');

			await expect(
				trackOperation(
					{
						type: 'api',
						name: 'Failing Operation'
					},
					async () => {
						throw error;
					}
				)
			).rejects.toThrow('Test error');

			const failed = operationsStore.failedOperations;
			expect(failed).toHaveLength(1);
			expect(failed[0].name).toBe('Failing Operation');
			expect(failed[0].error).toBe(error);
		});

		it('trackBatchOperation processes items', async () => {
			const items = [1, 2, 3];
			const processor = vi.fn().mockResolvedValue(undefined);

			await trackBatchOperation(
				items,
				{
					name: 'Batch Operation'
				},
				processor
			);

			expect(processor).toHaveBeenCalledTimes(3);
			expect(processor).toHaveBeenCalledWith(1, 0);
			expect(processor).toHaveBeenCalledWith(2, 1);
			expect(processor).toHaveBeenCalledWith(3, 2);
		});
	});

	describe('getters', () => {
		it('returns operations by status', () => {
			const id1 = operationsStore.create({ type: 'api', name: 'Op 1' });
			const id2 = operationsStore.create({ type: 'api', name: 'Op 2' });
			const id3 = operationsStore.create({ type: 'api', name: 'Op 3' });

			operationsStore.complete(id1);
			operationsStore.fail(id2, 'Error');
			// id3 still running

			expect(operationsStore.runningOperations).toHaveLength(1);
			expect(operationsStore.runningOperations[0].id).toBe(id3);

			expect(operationsStore.completedOperations).toHaveLength(1);
			expect(operationsStore.completedOperations[0].id).toBe(id1);

			expect(operationsStore.failedOperations).toHaveLength(1);
			expect(operationsStore.failedOperations[0].id).toBe(id2);
		});
	});
});
