/**
 * Concurrency Limiter Unit Tests
 *
 * Tests for concurrent execution limits, queue behavior, and failure handling.
 * Covers the ConcurrencyLimiter used for CLI operations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestLogger } from '../../../../scripts/smoke/lib/logger';
import { ConcurrencyLimiter } from '../../server/cli/concurrency-limiter';
import type { CLIResult, CLICommandConfig } from '../../server/cli/contracts';

const logger = createTestLogger('Unit: Concurrency Limiter');

function createMockResult(data: string): CLIResult {
	return {
		success: true,
		data,
		error: null,
		exitCode: 0,
		duration: 10,
		command: 'test'
	};
}

function createConfig(args: string[], dedupe?: boolean): CLICommandConfig {
	return {
		command: 'gt',
		args,
		...(dedupe !== undefined && { dedupe })
	};
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ConcurrencyLimiter', () => {
	let limiter: ConcurrencyLimiter;

	beforeEach(() => {
		logger.step('Setting up ConcurrencyLimiter test');
		limiter = new ConcurrencyLimiter(2);
		logger.info('Created limiter with maxConcurrency: 2');
	});

	describe('Concurrent Execution Limits', () => {
		it('limits concurrent executions to maxConcurrency', async () => {
			logger.step('Testing concurrency limit');
			let running = 0;
			let maxRunning = 0;

			const executor = vi.fn().mockImplementation(async () => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				logger.info(`Task started, running: ${running}, max: ${maxRunning}`);
				await delay(50);
				running--;
				logger.info(`Task completed, running: ${running}`);
				return createMockResult('ok');
			});

			const tasks = Array(5)
				.fill(null)
				.map((_, i) =>
					limiter.execute(createConfig([`task-${i}`], false), executor)
				);

			logger.info('Started 5 tasks with concurrency limit 2');

			await Promise.all(tasks);

			logger.info('Max concurrent executions', { maxRunning });
			expect(maxRunning).toBe(2);
			expect(executor).toHaveBeenCalledTimes(5);
			logger.success('Concurrency limit enforced correctly');
		});

		it('executes immediately when under limit', async () => {
			logger.step('Testing immediate execution under limit');
			const executor = vi.fn().mockResolvedValue(createMockResult('immediate'));

			const start = Date.now();
			const result = await limiter.execute(createConfig(['single']), executor);
			const elapsed = Date.now() - start;

			logger.info('Execution completed', { elapsed, data: result.data });
			expect(executor).toHaveBeenCalledTimes(1);
			expect(result.data).toBe('immediate');
			logger.success('Immediate execution verified');
		});
	});

	describe('Queue Behavior', () => {
		it('queues excess tasks when at capacity', async () => {
			logger.step('Testing queue behavior');
			const executor = vi.fn().mockImplementation(async () => {
				await delay(100);
				return createMockResult('queued');
			});

			// Start 3 tasks with limit of 2
			const promises = [
				limiter.execute(createConfig(['1'], false), executor),
				limiter.execute(createConfig(['2'], false), executor),
				limiter.execute(createConfig(['3'], false), executor)
			];

			await delay(10); // Let tasks start

			const stats = limiter.getStats();
			logger.info('Queue stats after starting 3 tasks', stats);

			expect(stats.active).toBe(2);
			expect(stats.queued).toBe(1);
			logger.success('Excess tasks queued correctly');

			await Promise.all(promises);
			logger.info('All tasks completed');
		});

		it('executes queued tasks when slot opens', async () => {
			logger.step('Testing queued task execution on slot open');
			const executionOrder: number[] = [];

			const executor = vi.fn().mockImplementation(async (config: CLICommandConfig) => {
				const taskNum = parseInt(config.args[0]);
				executionOrder.push(taskNum);
				logger.info(`Task ${taskNum} started`);
				await delay(50);
				logger.info(`Task ${taskNum} completed`);
				return createMockResult(`task-${taskNum}`);
			});

			const promises = [
				limiter.execute(createConfig(['1'], false), executor),
				limiter.execute(createConfig(['2'], false), executor),
				limiter.execute(createConfig(['3'], false), executor),
				limiter.execute(createConfig(['4'], false), executor)
			];

			await Promise.all(promises);

			logger.info('Execution order', { executionOrder });
			// Tasks 1 and 2 start immediately, 3 and 4 are queued
			expect(executionOrder).toEqual([1, 2, 3, 4]);
			logger.success('Queued tasks executed in FIFO order');
		});

		it('reports accurate queue statistics', async () => {
			logger.step('Testing queue statistics accuracy');
			const executor = vi.fn().mockImplementation(async () => {
				await delay(100);
				return createMockResult('ok');
			});

			// Initial stats
			let stats = limiter.getStats();
			logger.info('Initial stats', stats);
			expect(stats.active).toBe(0);
			expect(stats.queued).toBe(0);
			expect(stats.maxConcurrency).toBe(2);

			// Start tasks
			const p1 = limiter.execute(createConfig(['1'], false), executor);
			const p2 = limiter.execute(createConfig(['2'], false), executor);
			const p3 = limiter.execute(createConfig(['3'], false), executor);

			await delay(10);

			stats = limiter.getStats();
			logger.info('Stats with 3 tasks', stats);
			expect(stats.active).toBe(2);
			expect(stats.queued).toBe(1);

			await Promise.all([p1, p2, p3]);

			stats = limiter.getStats();
			logger.info('Stats after completion', stats);
			expect(stats.active).toBe(0);
			expect(stats.queued).toBe(0);
			logger.success('Queue statistics reported accurately');
		});
	});

	describe('Task Failure Handling', () => {
		it('handles task failures gracefully without blocking queue', async () => {
			logger.step('Testing graceful failure handling');
			let taskCount = 0;

			// Use a failure result instead of throwing to avoid unhandled rejection
			// (ConcurrencyLimiter re-throws errors in background processQueue)
			const executor = vi.fn().mockImplementation(async (config: CLICommandConfig) => {
				taskCount++;
				const taskNum = parseInt(config.args[0]);
				logger.info(`Task ${taskNum} executing`);

				await delay(30);

				if (taskNum === 2) {
					logger.info('Task 2 returns failure result');
					return {
						success: false,
						data: null,
						error: 'Intentional failure',
						exitCode: 1,
						duration: 10,
						command: 'test'
					} satisfies CLIResult;
				}

				return createMockResult(`success-${taskNum}`);
			});

			const promises = [
				limiter.execute(createConfig(['1'], false), executor),
				limiter.execute(createConfig(['2'], false), executor),
				limiter.execute(createConfig(['3'], false), executor)
			];

			const results = await Promise.all(promises);

			logger.info('Results', {
				results: results.map((r) => ({ success: r.success, data: r.data })),
				taskCount
			});

			expect(taskCount).toBe(3);
			expect(results.filter((r) => r.success)).toHaveLength(2);
			expect(results.filter((r) => !r.success)).toHaveLength(1);
			expect(results.find((r) => !r.success)?.error).toBe('Intentional failure');
			logger.success('Failures handled gracefully, queue continued');
		});

		it('rejects pending requests on clear()', async () => {
			logger.step('Testing clear() rejection behavior');
			const executor = vi.fn().mockImplementation(async () => {
				await delay(200);
				return createMockResult('ok');
			});

			// Start tasks - first 2 run, third queued
			const p1 = limiter.execute(createConfig(['1'], false), executor);
			const p2 = limiter.execute(createConfig(['2'], false), executor);
			const p3 = limiter.execute(createConfig(['3'], false), executor);

			await delay(10);

			const statsBefore = limiter.getStats();
			logger.info('Stats before clear', statsBefore);

			limiter.clear();
			logger.info('Clear called');

			// The queued task should be rejected
			await expect(p3).rejects.toThrow('Queue cleared');
			logger.success('Queued task rejected on clear');
		});
	});

	describe('Request Deduplication', () => {
		it('deduplicates identical requests by default', async () => {
			logger.step('Testing request deduplication');
			let resolveFirst: (r: CLIResult) => void;
			const firstPromise = new Promise<CLIResult>((r) => {
				resolveFirst = r;
			});

			const executor = vi.fn().mockReturnValue(firstPromise);
			const config = createConfig(['status']);

			const p1 = limiter.execute(config, executor);
			const p2 = limiter.execute(config, executor);

			logger.info('Started 2 identical requests');
			expect(executor).toHaveBeenCalledTimes(1);
			logger.info('Executor called only once due to deduplication');

			resolveFirst!(createMockResult('deduped'));
			const [r1, r2] = await Promise.all([p1, p2]);

			expect(r1.data).toBe('deduped');
			expect(r2.data).toBe('deduped');
			logger.success('Both requests received same result');
		});

		it('skips deduplication when dedupe: false', async () => {
			logger.step('Testing dedupe: false behavior');
			const executor = vi.fn().mockResolvedValue(createMockResult('ok'));
			const config = createConfig(['status'], false);

			await Promise.all([limiter.execute(config, executor), limiter.execute(config, executor)]);

			logger.info('Executor call count', { count: executor.mock.calls.length });
			expect(executor).toHaveBeenCalledTimes(2);
			logger.success('Deduplication disabled with dedupe: false');
		});

		it('uses command and args as dedupe key', async () => {
			logger.step('Testing dedupe key generation');
			let resolves: Array<(r: CLIResult) => void> = [];
			const executor = vi.fn().mockImplementation(
				() =>
					new Promise<CLIResult>((resolve) => {
						resolves.push(resolve);
					})
			);

			// Different args = different dedupe keys
			const p1 = limiter.execute(createConfig(['list']), executor);
			const p2 = limiter.execute(createConfig(['status']), executor);
			const p3 = limiter.execute(createConfig(['list']), executor); // Same as p1

			await delay(10);

			logger.info('Executor call count for 3 requests (2 unique)', {
				count: executor.mock.calls.length
			});
			// p1 and p3 are deduped, p2 is unique
			expect(executor).toHaveBeenCalledTimes(2);

			// Resolve all
			resolves.forEach((r) => r(createMockResult('done')));
			await Promise.all([p1, p2, p3]);

			logger.success('Dedupe key correctly based on command and args');
		});
	});

	describe('Configurable Concurrency', () => {
		it('respects custom maxConcurrency value', async () => {
			logger.step('Testing custom maxConcurrency');
			const customLimiter = new ConcurrencyLimiter(4);
			let maxRunning = 0;
			let running = 0;

			const executor = vi.fn().mockImplementation(async () => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				await delay(30);
				running--;
				return createMockResult('ok');
			});

			const tasks = Array(6)
				.fill(null)
				.map((_, i) =>
					customLimiter.execute(createConfig([`task-${i}`], false), executor)
				);

			await Promise.all(tasks);

			logger.info('Max running with limit 4', { maxRunning });
			expect(maxRunning).toBe(4);

			const stats = customLimiter.getStats();
			expect(stats.maxConcurrency).toBe(4);
			logger.success('Custom concurrency limit respected');
		});

		it('uses default maxConcurrency when not specified', () => {
			logger.step('Testing default maxConcurrency');
			const defaultLimiter = new ConcurrencyLimiter();
			const stats = defaultLimiter.getStats();

			logger.info('Default stats', stats);
			expect(stats.maxConcurrency).toBe(4); // DEFAULT_CONFIG.maxConcurrency
			logger.success('Default concurrency applied');
		});
	});
});
