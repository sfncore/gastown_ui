import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	pollingManager,
	usePolling,
	getPolling,
	removePolling,
	createMultiTierPolling,
	POLLING_TIERS
} from './polling.svelte';
import { apiClient } from '$lib/api/client';

// Mock API client
vi.mock('$lib/api/client', () => ({
	apiClient: {
		get: vi.fn()
	},
	isApiError: vi.fn()
}));

// Mock network state
vi.mock('./network.svelte', () => ({
	networkState: {
		isOffline: false,
		onStatusChange: vi.fn(() => vi.fn())
	}
}));

describe('Multi-Tier Polling System', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pollingManager.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		pollingManager.destroy();
		vi.useRealTimers();
	});

	describe('usePolling', () => {
		it('creates a polling instance', () => {
			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			expect(instance).toBeDefined();
			expect(instance.state.data).toBeNull();
			expect(instance.state.isLoading).toBe(false);
		});

		it('returns existing instance for same key', () => {
			const instance1 = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			const instance2 = usePolling({
				key: 'test',
				endpoint: '/api/test2',
				interval: 2000,
				enabled: false
			});

			expect(instance1).toBe(instance2);
		});

		it('fetches data on start', async () => {
			const mockData = { id: 1, name: 'Test' };
			vi.mocked(apiClient.get).mockResolvedValue({
				data: mockData,
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			instance.start();

			// Wait for fetch to complete
			await vi.runAllTimersAsync();

			expect(apiClient.get).toHaveBeenCalledWith('/api/test', expect.any(Object));
			expect(instance.state.data).toEqual(mockData);
			expect(instance.state.error).toBeNull();
		});

		it('polls at specified interval', async () => {
			vi.mocked(apiClient.get).mockResolvedValue({
				data: { count: 1 },
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 5000,
				enabled: false
			});

			instance.start();

			// Initial fetch
			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(1);

			// Second poll after interval
			await vi.advanceTimersByTimeAsync(5000);
			expect(apiClient.get).toHaveBeenCalledTimes(2);

			// Third poll
			await vi.advanceTimersByTimeAsync(5000);
			expect(apiClient.get).toHaveBeenCalledTimes(3);
		});

		it('shows stale data while revalidating', async () => {
			const initialData = { count: 1 };
			const updatedData = { count: 2 };

			vi.mocked(apiClient.get)
				.mockResolvedValueOnce({
					data: initialData,
					status: 200,
					headers: new Headers()
				})
				.mockResolvedValueOnce({
					data: updatedData,
					status: 200,
					headers: new Headers()
				});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 10000,
				staleTime: 5000,
				enabled: false
			});

			instance.start();

			// Initial fetch
			await vi.runAllTimersAsync();
			expect(instance.state.data).toEqual(initialData);
			expect(instance.state.isStale).toBe(false);

			// Wait for data to become stale
			await vi.advanceTimersByTimeAsync(6000);

			// Trigger revalidation
			await vi.advanceTimersByTimeAsync(4000);

			// Should show old data while validating
			expect(instance.state.isValidating).toBe(true);
			expect(instance.state.data).toEqual(initialData);

			// After validation completes
			await vi.runAllTimersAsync();
			expect(instance.state.data).toEqual(updatedData);
			expect(instance.state.isValidating).toBe(false);
			expect(instance.state.isStale).toBe(false);
		});

		it('handles transform function', async () => {
			const rawData = { value: '42' };
			vi.mocked(apiClient.get).mockResolvedValue({
				data: rawData,
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false,
				transform: (data: unknown) => ({
					value: parseInt((data as typeof rawData).value, 10)
				})
			});

			instance.start();
			await vi.runAllTimersAsync();

			expect(instance.state.data).toEqual({ value: 42 });
		});

		it('calls onSuccess callback', async () => {
			const mockData = { id: 1 };
			const onSuccess = vi.fn();

			vi.mocked(apiClient.get).mockResolvedValue({
				data: mockData,
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false,
				onSuccess
			});

			instance.start();
			await vi.runAllTimersAsync();

			expect(onSuccess).toHaveBeenCalledWith(mockData);
		});

		it('calls onError callback on failure', async () => {
			const error = new Error('API Error');
			const onError = vi.fn();

			vi.mocked(apiClient.get).mockRejectedValue(error);

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false,
				onError
			});

			instance.start();
			await vi.runAllTimersAsync();

			expect(onError).toHaveBeenCalledWith(error);
			expect(instance.state.error).toBe(error);
		});
	});

	describe('polling lifecycle', () => {
		it('stops polling on stop()', async () => {
			vi.mocked(apiClient.get).mockResolvedValue({
				data: {},
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			instance.start();
			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(1);

			instance.stop();
			await vi.advanceTimersByTimeAsync(5000);
			expect(apiClient.get).toHaveBeenCalledTimes(1); // No more calls
		});

		it('pauses and resumes polling', async () => {
			vi.mocked(apiClient.get).mockResolvedValue({
				data: {},
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			instance.start();
			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(1);

			instance.pause();
			await vi.advanceTimersByTimeAsync(5000);
			expect(apiClient.get).toHaveBeenCalledTimes(1); // Paused

			instance.resume();
			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(2); // Resumed
		});

		it('supports manual refetch', async () => {
			vi.mocked(apiClient.get).mockResolvedValue({
				data: {},
				status: 200,
				headers: new Headers()
			});

			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 10000,
				enabled: false
			});

			instance.start();
			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(1);

			await instance.refetch();
			expect(apiClient.get).toHaveBeenCalledTimes(2);
		});

		it('supports optimistic updates with mutate', async () => {
			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			const newData = { id: 1, name: 'Updated' };
			instance.mutate(newData);

			expect(instance.state.data).toEqual(newData);
			expect(instance.state.isStale).toBe(false);
			expect(instance.state.error).toBeNull();
		});
	});

	describe('pollingManager', () => {
		it('gets existing instance', () => {
			const instance = usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			const retrieved = getPolling('test');
			expect(retrieved).toBe(instance);
		});

		it('removes instance', () => {
			usePolling({
				key: 'test',
				endpoint: '/api/test',
				interval: 1000,
				enabled: false
			});

			removePolling('test');

			expect(getPolling('test')).toBeUndefined();
		});

		it('pauses all instances', async () => {
			vi.mocked(apiClient.get).mockResolvedValue({
				data: {},
				status: 200,
				headers: new Headers()
			});

			const instance1 = usePolling({
				key: 'test1',
				endpoint: '/api/test1',
				interval: 1000,
				enabled: false
			});

			const instance2 = usePolling({
				key: 'test2',
				endpoint: '/api/test2',
				interval: 1000,
				enabled: false
			});

			instance1.start();
			instance2.start();

			await vi.advanceTimersByTimeAsync(100);
			expect(apiClient.get).toHaveBeenCalledTimes(2);

			pollingManager.pauseAll();

			await vi.advanceTimersByTimeAsync(5000);
			expect(apiClient.get).toHaveBeenCalledTimes(2); // No more calls
		});
	});

	describe('createMultiTierPolling', () => {
		it('creates instances with correct intervals', () => {
			const tiers = createMultiTierPolling({
				critical: [{ key: 'agents', endpoint: '/api/agents' }],
				normal: [{ key: 'queue', endpoint: '/api/queue' }],
				background: [{ key: 'stats', endpoint: '/api/stats' }]
			});

			expect(tiers.critical).toHaveLength(1);
			expect(tiers.normal).toHaveLength(1);
			expect(tiers.background).toHaveLength(1);

			// Verify instances exist in manager
			expect(getPolling('agents')).toBeDefined();
			expect(getPolling('queue')).toBeDefined();
			expect(getPolling('stats')).toBeDefined();
		});
	});

	describe('POLLING_TIERS', () => {
		it('has expected tier values', () => {
			expect(POLLING_TIERS.REALTIME).toBe(2000);
			expect(POLLING_TIERS.FAST).toBe(5000);
			expect(POLLING_TIERS.MEDIUM).toBe(15000);
			expect(POLLING_TIERS.SLOW).toBe(60000);
			expect(POLLING_TIERS.VERY_SLOW).toBe(300000);
		});
	});
});
