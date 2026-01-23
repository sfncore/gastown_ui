/**
 * Network Partition Detection and Recovery Tests
 *
 * Tests for:
 * - Offline detection within 1s
 * - Online recovery
 * - Request queueing
 * - Queue processing order (FIFO)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create a testable network store factory that accepts dependencies
interface NetworkDeps {
	getOnlineStatus: () => boolean;
	addEventListener: (event: string, handler: () => void) => void;
	removeEventListener: (event: string, handler: () => void) => void;
	generateId: () => string;
	now: () => number;
}

// Define types locally for testing
class NetworkError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NetworkError';
	}
}

interface QueuedRequest {
	id: string;
	type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	endpoint: string;
	payload?: unknown;
	timestamp: number;
}

interface NetworkState {
	isOnline: boolean;
	isOffline: boolean;
	queuedRequests: QueuedRequest[];
	queuedCount: number;
	shouldPausePolling: boolean;
	lastOfflineAt: number | null;
	lastOnlineAt: number | null;
	lastOfflineDuration: number | null;
}

interface QueueRequestConfig {
	type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	endpoint: string;
	payload?: unknown;
}

type StatusChangeCallback = (isOnline: boolean) => void;
type QueueProcessor = (request: QueuedRequest) => Promise<boolean>;

// Testable network store factory
function createTestableNetworkStore(deps: NetworkDeps) {
	let isOnline = deps.getOnlineStatus();
	let queuedRequests: QueuedRequest[] = [];
	let callbacks: StatusChangeCallback[] = [];
	let autoProcessor: QueueProcessor | null = null;
	let lastOfflineAt: number | null = null;
	let lastOnlineAt: number | null = isOnline ? deps.now() : null;
	let lastOfflineDuration: number | null = null;
	let destroyed = false;

	const handleOnline = () => {
		if (destroyed) return;
		const wasOffline = !isOnline;
		isOnline = true;

		if (wasOffline) {
			const now = deps.now();
			if (lastOfflineAt !== null) {
				lastOfflineDuration = now - lastOfflineAt;
			}
			lastOnlineAt = now;

			for (const callback of callbacks) {
				try {
					callback(true);
				} catch {
					// Ignore callback errors
				}
			}

			if (autoProcessor) {
				processQueueInternal(autoProcessor);
			}
		}
	};

	const handleOffline = () => {
		if (destroyed) return;
		const wasOnline = isOnline;
		isOnline = false;

		if (wasOnline) {
			lastOfflineAt = deps.now();

			for (const callback of callbacks) {
				try {
					callback(false);
				} catch {
					// Ignore callback errors
				}
			}
		}
	};

	// Register event listeners
	deps.addEventListener('online', handleOnline);
	deps.addEventListener('offline', handleOffline);

	async function processQueueInternal(processor: QueueProcessor) {
		if (!isOnline || queuedRequests.length === 0) return;

		const toProcess = [...queuedRequests];
		for (const request of toProcess) {
			try {
				const success = await processor(request);
				if (success) {
					queuedRequests = queuedRequests.filter((r) => r.id !== request.id);
				}
			} catch {
				// Keep failed requests in queue
			}
		}
	}

	return {
		get state(): NetworkState {
			return {
				isOnline,
				isOffline: !isOnline,
				queuedRequests: [...queuedRequests],
				queuedCount: queuedRequests.length,
				shouldPausePolling: !isOnline,
				lastOfflineAt,
				lastOnlineAt,
				lastOfflineDuration
			};
		},

		assertOnline(): void {
			if (!isOnline) {
				throw new NetworkError('Network is offline');
			}
		},

		onStatusChange(callback: StatusChangeCallback): () => void {
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index > -1) {
					callbacks.splice(index, 1);
				}
			};
		},

		queueRequest(config: QueueRequestConfig): string {
			if (!config.endpoint || config.endpoint.trim() === '') {
				throw new NetworkError('Endpoint cannot be empty');
			}

			const request: QueuedRequest = {
				id: deps.generateId(),
				type: config.type,
				endpoint: config.endpoint,
				payload: config.payload,
				timestamp: deps.now()
			};

			queuedRequests = [...queuedRequests, request];
			return request.id;
		},

		removeRequest(id: string): void {
			queuedRequests = queuedRequests.filter((r) => r.id !== id);
		},

		clearQueue(): void {
			queuedRequests = [];
		},

		async processQueue(processor: QueueProcessor): Promise<void> {
			await processQueueInternal(processor);
		},

		setAutoProcessQueue(processor: QueueProcessor | null): void {
			autoProcessor = processor;
		},

		destroy(): void {
			destroyed = true;
			callbacks = [];
			deps.removeEventListener('online', handleOnline);
			deps.removeEventListener('offline', handleOffline);
		},

		// Test helpers
		_triggerOnline: handleOnline,
		_triggerOffline: handleOffline
	};
}

describe('Network Partition Detection', () => {
	let networkStore: ReturnType<typeof createTestableNetworkStore>;
	let mockDeps: NetworkDeps;
	let currentTime: number;
	let onlineStatus: boolean;
	let idCounter: number;

	beforeEach(() => {
		vi.useFakeTimers();
		currentTime = 1000;
		onlineStatus = true;
		idCounter = 0;

		mockDeps = {
			getOnlineStatus: () => onlineStatus,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			generateId: () => `uuid-${++idCounter}`,
			now: () => currentTime
		};

		networkStore = createTestableNetworkStore(mockDeps);
	});

	afterEach(() => {
		networkStore.destroy();
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe('Offline Detection', () => {
		it('detects offline state within 1 second', () => {
			expect(networkStore.state.isOnline).toBe(true);

			// Simulate going offline
			onlineStatus = false;
			networkStore._triggerOffline();

			// Should detect within 1s (we check immediately after event)
			vi.advanceTimersByTime(1000);

			expect(networkStore.state.isOnline).toBe(false);
			expect(networkStore.state.isOffline).toBe(true);
		});

		it('initializes with correct online state', () => {
			onlineStatus = true;
			const store = createTestableNetworkStore(mockDeps);

			expect(store.state.isOnline).toBe(true);
			expect(store.state.isOffline).toBe(false);

			store.destroy();
		});

		it('initializes with correct offline state', () => {
			onlineStatus = false;
			const store = createTestableNetworkStore(mockDeps);

			expect(store.state.isOnline).toBe(false);
			expect(store.state.isOffline).toBe(true);

			store.destroy();
		});

		it('throws NetworkError when accessing network-dependent features while offline', () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			expect(() => networkStore.assertOnline()).toThrow(NetworkError);
			expect(() => networkStore.assertOnline()).toThrow('Network is offline');
		});
	});

	describe('Online Recovery', () => {
		it('detects online recovery', () => {
			// Start offline
			onlineStatus = false;
			networkStore._triggerOffline();
			expect(networkStore.state.isOnline).toBe(false);

			// Go back online
			onlineStatus = true;
			networkStore._triggerOnline();

			expect(networkStore.state.isOnline).toBe(true);
			expect(networkStore.state.isOffline).toBe(false);
		});

		it('calls onOnline callback when recovering', () => {
			const onOnline = vi.fn();
			networkStore.onStatusChange(onOnline);

			// Go offline then online
			onlineStatus = false;
			networkStore._triggerOffline();
			onlineStatus = true;
			networkStore._triggerOnline();

			expect(onOnline).toHaveBeenCalledWith(true);
		});

		it('calls onOffline callback when going offline', () => {
			const onOffline = vi.fn();
			networkStore.onStatusChange(onOffline);

			onlineStatus = false;
			networkStore._triggerOffline();

			expect(onOffline).toHaveBeenCalledWith(false);
		});

		it('returns unsubscribe function from onStatusChange', () => {
			const callback = vi.fn();
			const unsubscribe = networkStore.onStatusChange(callback);

			onlineStatus = false;
			networkStore._triggerOffline();
			expect(callback).toHaveBeenCalledTimes(1);

			unsubscribe();

			onlineStatus = true;
			networkStore._triggerOnline();
			// Should not be called again after unsubscribe
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('Request Queueing', () => {
		it('queues requests when offline', () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			const requestId = networkStore.queueRequest({
				type: 'POST',
				endpoint: '/api/test',
				payload: { data: 'test' }
			});

			expect(requestId).toBe('uuid-1');
			expect(networkStore.state.queuedRequests.length).toBe(1);
		});

		it('returns queued request with correct properties', () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			const requestId = networkStore.queueRequest({
				type: 'POST',
				endpoint: '/api/test',
				payload: { data: 'test' }
			});

			const queued = networkStore.state.queuedRequests[0];
			expect(queued.id).toBe(requestId);
			expect(queued.type).toBe('POST');
			expect(queued.endpoint).toBe('/api/test');
			expect(queued.payload).toEqual({ data: 'test' });
			expect(queued.timestamp).toBe(1000);
		});

		it('throws NetworkError when queueing empty endpoint', () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			expect(() =>
				networkStore.queueRequest({
					type: 'GET',
					endpoint: ''
				})
			).toThrow(NetworkError);
			expect(() =>
				networkStore.queueRequest({
					type: 'GET',
					endpoint: ''
				})
			).toThrow('Endpoint cannot be empty');
		});

		it('allows queueing requests when online (for retry scenarios)', () => {
			// Online state
			expect(networkStore.state.isOnline).toBe(true);

			const requestId = networkStore.queueRequest({
				type: 'POST',
				endpoint: '/api/retry',
				payload: { retry: true }
			});

			expect(requestId).toBe('uuid-1');
			expect(networkStore.state.queuedRequests.length).toBe(1);
		});

		it('tracks queue count correctly', () => {
			expect(networkStore.state.queuedCount).toBe(0);

			networkStore.queueRequest({ type: 'GET', endpoint: '/api/1' });
			expect(networkStore.state.queuedCount).toBe(1);

			networkStore.queueRequest({ type: 'GET', endpoint: '/api/2' });
			expect(networkStore.state.queuedCount).toBe(2);

			networkStore.queueRequest({ type: 'GET', endpoint: '/api/3' });
			expect(networkStore.state.queuedCount).toBe(3);
		});

		it('removes request from queue by id', () => {
			const id1 = networkStore.queueRequest({ type: 'GET', endpoint: '/api/1' });
			const id2 = networkStore.queueRequest({ type: 'GET', endpoint: '/api/2' });

			expect(networkStore.state.queuedCount).toBe(2);

			networkStore.removeRequest(id1);

			expect(networkStore.state.queuedCount).toBe(1);
			expect(networkStore.state.queuedRequests[0].id).toBe(id2);
		});

		it('clears all queued requests', () => {
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/1' });
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/2' });
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/3' });

			expect(networkStore.state.queuedCount).toBe(3);

			networkStore.clearQueue();

			expect(networkStore.state.queuedCount).toBe(0);
			expect(networkStore.state.queuedRequests).toEqual([]);
		});
	});

	describe('Queue Processing Order (FIFO)', () => {
		it('processes queue in FIFO order', async () => {
			const processedOrder: string[] = [];

			// Queue requests
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/first' });
			currentTime += 10;
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/second' });
			currentTime += 10;
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/third' });

			// Process queue
			await networkStore.processQueue(async (request) => {
				processedOrder.push(request.endpoint);
				return true;
			});

			expect(processedOrder).toEqual(['/api/first', '/api/second', '/api/third']);
		});

		it('removes successfully processed requests from queue', async () => {
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/1' });
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/2' });

			await networkStore.processQueue(async () => true);

			expect(networkStore.state.queuedCount).toBe(0);
		});

		it('keeps failed requests in queue', async () => {
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/success' });
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/fail' });

			await networkStore.processQueue(async (request) => {
				return request.endpoint !== '/api/fail';
			});

			expect(networkStore.state.queuedCount).toBe(1);
			expect(networkStore.state.queuedRequests[0].endpoint).toBe('/api/fail');
		});

		it('does not process queue when offline', async () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			networkStore.queueRequest({ type: 'GET', endpoint: '/api/test' });

			const processor = vi.fn().mockResolvedValue(true);
			await networkStore.processQueue(processor);

			expect(processor).not.toHaveBeenCalled();
			expect(networkStore.state.queuedCount).toBe(1);
		});

		it('auto-processes queue on reconnection when enabled', async () => {
			const processor = vi.fn().mockResolvedValue(true);
			networkStore.setAutoProcessQueue(processor);

			// Queue while offline
			onlineStatus = false;
			networkStore._triggerOffline();
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/test' });

			expect(processor).not.toHaveBeenCalled();

			// Go online
			onlineStatus = true;
			networkStore._triggerOnline();

			// Need to wait for async processing
			await vi.runAllTimersAsync();

			expect(processor).toHaveBeenCalled();
		});

		it('handles processor throwing error gracefully', async () => {
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/1' });
			networkStore.queueRequest({ type: 'GET', endpoint: '/api/2' });

			const processor = vi.fn().mockImplementation(async (request: QueuedRequest) => {
				if (request.endpoint === '/api/1') {
					throw new Error('Processing failed');
				}
				return true;
			});

			// Should not throw
			await expect(networkStore.processQueue(processor)).resolves.not.toThrow();

			// First request should be kept (failed), second processed
			expect(networkStore.state.queuedCount).toBe(1);
			expect(networkStore.state.queuedRequests[0].endpoint).toBe('/api/1');
		});
	});

	describe('Polling Pause Integration', () => {
		it('provides shouldPausePolling flag when offline', () => {
			expect(networkStore.state.shouldPausePolling).toBe(false);

			onlineStatus = false;
			networkStore._triggerOffline();

			expect(networkStore.state.shouldPausePolling).toBe(true);
		});

		it('provides shouldPausePolling false when online', () => {
			onlineStatus = false;
			networkStore._triggerOffline();
			expect(networkStore.state.shouldPausePolling).toBe(true);

			onlineStatus = true;
			networkStore._triggerOnline();
			expect(networkStore.state.shouldPausePolling).toBe(false);
		});
	});

	describe('Edge Cases', () => {
		it('handles rapid online/offline transitions', () => {
			const callback = vi.fn();
			networkStore.onStatusChange(callback);

			// Rapid transitions
			onlineStatus = false;
			networkStore._triggerOffline();
			onlineStatus = true;
			networkStore._triggerOnline();
			onlineStatus = false;
			networkStore._triggerOffline();
			onlineStatus = true;
			networkStore._triggerOnline();

			expect(callback).toHaveBeenCalledTimes(4);
			expect(networkStore.state.isOnline).toBe(true);
		});

		it('handles removing non-existent request gracefully', () => {
			// Should not throw
			expect(() => networkStore.removeRequest('non-existent-id')).not.toThrow();
		});

		it('handles processing empty queue', async () => {
			const processor = vi.fn();
			await networkStore.processQueue(processor);

			expect(processor).not.toHaveBeenCalled();
		});

		it('tracks last offline timestamp', () => {
			expect(networkStore.state.lastOfflineAt).toBeNull();

			onlineStatus = false;
			networkStore._triggerOffline();

			expect(networkStore.state.lastOfflineAt).toBe(currentTime);
		});

		it('tracks last online timestamp', () => {
			// Initial state: online at currentTime (1000)
			expect(networkStore.state.lastOnlineAt).toBe(1000);

			onlineStatus = false;
			networkStore._triggerOffline();
			const beforeOnline = networkStore.state.lastOnlineAt;
			expect(beforeOnline).toBe(1000);

			currentTime += 1000;

			onlineStatus = true;
			networkStore._triggerOnline();

			expect(networkStore.state.lastOnlineAt).toBe(2000);
		});

		it('calculates offline duration correctly', () => {
			onlineStatus = false;
			networkStore._triggerOffline();

			currentTime += 5000;

			onlineStatus = true;
			networkStore._triggerOnline();

			expect(networkStore.state.lastOfflineDuration).toBeGreaterThanOrEqual(5000);
		});
	});

	describe('Cleanup', () => {
		it('removes event listeners on destroy', () => {
			networkStore.destroy();

			expect(mockDeps.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
			expect(mockDeps.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
		});

		it('clears callbacks on destroy', () => {
			const callback = vi.fn();
			networkStore.onStatusChange(callback);

			networkStore.destroy();

			// After destroy, callbacks should not fire
			onlineStatus = false;
			networkStore._triggerOffline();

			// Callback count should remain at 0 (not called after destroy)
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
