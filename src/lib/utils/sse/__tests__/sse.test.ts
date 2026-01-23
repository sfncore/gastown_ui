import { describe, it, expect } from 'vitest';
import {
	calculateBackoff,
	shouldFullRefresh,
	createReconnectionState,
	createDefaultConfig,
	updateReconnectionState,
	resetReconnectionState,
	type SSEReconnectionConfig,
	type SSEReconnectionState,
	type SSEStateUpdateEvent,
	SSEReconnectionError
} from '../index';

describe('SSEReconnectionConfig interface', () => {
	it('has correct structure with all required fields', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		expect(config).toEqual({
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		});
	});

	it('supports optional backoffMultiplier', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000,
			backoffMultiplier: 2
		};

		expect(config.backoffMultiplier).toBe(2);
	});
});

describe('SSEReconnectionState interface', () => {
	it('has correct structure with all required fields', () => {
		const state: SSEReconnectionState = {
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		};

		expect(state).toEqual({
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});

	it('tracks lastEventId when present', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'event-12345',
			attemptCount: 3,
			disconnectedAt: 1700000000000,
			lastAttemptAt: 1700000005000
		};

		expect(state.lastEventId).toBe('event-12345');
		expect(state.attemptCount).toBe(3);
	});
});

describe('calculateBackoff', () => {
	it('returns initial delay (1s) for first attempt', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = calculateBackoff(0, config);

		expect(result).toBe(1000);
	});

	it('returns 2s for second attempt', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = calculateBackoff(1, config);

		expect(result).toBe(2000);
	});

	it('returns 4s for third attempt', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = calculateBackoff(2, config);

		expect(result).toBe(4000);
	});

	it('returns 8s for fourth attempt', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = calculateBackoff(3, config);

		expect(result).toBe(8000);
	});

	it('caps delay at maxDelayMs (30s)', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		// 2^5 * 1000 = 32000, should be capped at 30000
		const result = calculateBackoff(5, config);

		expect(result).toBe(30000);
	});

	it('remains capped at maxDelayMs for very high attempt counts', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = calculateBackoff(100, config);

		expect(result).toBe(30000);
	});

	it('uses custom backoffMultiplier when provided', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000,
			backoffMultiplier: 3
		};

		// 3^1 * 1000 = 3000
		const result = calculateBackoff(1, config);

		expect(result).toBe(3000);
	});

	it('throws SSEReconnectionError for negative attempt count', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		expect(() => calculateBackoff(-1, config)).toThrow(SSEReconnectionError);
		expect(() => calculateBackoff(-1, config)).toThrow('Attempt count cannot be negative');
	});

	it('throws SSEReconnectionError for negative initialDelayMs', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: -1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		expect(() => calculateBackoff(0, config)).toThrow(SSEReconnectionError);
		expect(() => calculateBackoff(0, config)).toThrow('Initial delay must be positive');
	});

	it('throws SSEReconnectionError for zero initialDelayMs', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 0,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		expect(() => calculateBackoff(0, config)).toThrow(SSEReconnectionError);
		expect(() => calculateBackoff(0, config)).toThrow('Initial delay must be positive');
	});

	it('throws SSEReconnectionError for negative maxDelayMs', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: -30000,
			fullRefreshThresholdMs: 300000
		};

		expect(() => calculateBackoff(0, config)).toThrow(SSEReconnectionError);
		expect(() => calculateBackoff(0, config)).toThrow('Max delay must be positive');
	});

	it('throws SSEReconnectionError for zero maxDelayMs', () => {
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 0,
			fullRefreshThresholdMs: 300000
		};

		expect(() => calculateBackoff(0, config)).toThrow(SSEReconnectionError);
		expect(() => calculateBackoff(0, config)).toThrow('Max delay must be positive');
	});
});

describe('shouldFullRefresh', () => {
	it('returns false when disconnectedAt is null', () => {
		const state: SSEReconnectionState = {
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000
		};

		const result = shouldFullRefresh(state, config);

		expect(result).toBe(false);
	});

	it('returns false when disconnected less than threshold (under 5 minutes)', () => {
		const now = 1700000300000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 3,
			disconnectedAt: 1700000100000, // 200 seconds ago (less than 5 min)
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000 // 5 minutes
		};

		const result = shouldFullRefresh(state, config, now);

		expect(result).toBe(false);
	});

	it('returns true when disconnected exactly at threshold (5 minutes)', () => {
		const now = 1700000300000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 5,
			disconnectedAt: 1700000000000, // exactly 300 seconds ago (5 min)
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000 // 5 minutes
		};

		const result = shouldFullRefresh(state, config, now);

		expect(result).toBe(true);
	});

	it('returns true when disconnected more than threshold (over 5 minutes)', () => {
		const now = 1700000400000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 10,
			disconnectedAt: 1700000000000, // 400 seconds ago (over 5 min)
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000 // 5 minutes
		};

		const result = shouldFullRefresh(state, config, now);

		expect(result).toBe(true);
	});

	it('throws SSEReconnectionError for negative threshold', () => {
		const state: SSEReconnectionState = {
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: 1700000000000,
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: -300000
		};

		expect(() => shouldFullRefresh(state, config)).toThrow(SSEReconnectionError);
		expect(() => shouldFullRefresh(state, config)).toThrow(
			'Full refresh threshold must be positive'
		);
	});

	it('throws SSEReconnectionError for zero threshold', () => {
		const state: SSEReconnectionState = {
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: 1700000000000,
			lastAttemptAt: null
		};
		const config: SSEReconnectionConfig = {
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 0
		};

		expect(() => shouldFullRefresh(state, config)).toThrow(SSEReconnectionError);
		expect(() => shouldFullRefresh(state, config)).toThrow(
			'Full refresh threshold must be positive'
		);
	});
});

describe('createReconnectionState', () => {
	it('creates initial state with all null/zero values', () => {
		const state = createReconnectionState();

		expect(state).toEqual({
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});

	it('creates state with provided lastEventId', () => {
		const state = createReconnectionState('event-abc-123');

		expect(state).toEqual({
			lastEventId: 'event-abc-123',
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});

	it('creates state with empty string lastEventId', () => {
		const state = createReconnectionState('');

		expect(state).toEqual({
			lastEventId: '',
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});
});

describe('updateReconnectionState', () => {
	it('increments attemptCount on reconnect attempt', () => {
		const now = 1700000000000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 2,
			disconnectedAt: 1699999900000,
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, { type: 'attempt' }, now);

		expect(newState.attemptCount).toBe(3);
		expect(newState.lastAttemptAt).toBe(1700000000000);
		expect(newState.lastEventId).toBe('event-123');
		expect(newState.disconnectedAt).toBe(1699999900000);
	});

	it('sets disconnectedAt on disconnect when null', () => {
		const now = 1700000000000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, { type: 'disconnect' }, now);

		expect(newState.disconnectedAt).toBe(1700000000000);
		expect(newState.lastEventId).toBe('event-123');
		expect(newState.attemptCount).toBe(0);
	});

	it('preserves existing disconnectedAt on subsequent disconnect', () => {
		const now = 1700000100000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 3,
			disconnectedAt: 1700000000000, // already set
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, { type: 'disconnect' }, now);

		expect(newState.disconnectedAt).toBe(1700000000000); // preserved
	});

	it('updates lastEventId when provided in event', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'old-event',
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, {
			type: 'event',
			eventId: 'new-event-456'
		});

		expect(newState.lastEventId).toBe('new-event-456');
	});

	it('preserves lastEventId when event has no id', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'old-event',
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, { type: 'event' });

		expect(newState.lastEventId).toBe('old-event');
	});

	it('does not mutate original state', () => {
		const now = 1700000000000;

		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 2,
			disconnectedAt: null,
			lastAttemptAt: null
		};

		const newState = updateReconnectionState(state, { type: 'attempt' }, now);

		expect(state.attemptCount).toBe(2);
		expect(newState.attemptCount).toBe(3);
	});
});

describe('resetReconnectionState', () => {
	it('resets state on successful reconnect', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 5,
			disconnectedAt: 1700000000000,
			lastAttemptAt: 1700000010000
		};

		const newState = resetReconnectionState(state);

		expect(newState).toEqual({
			lastEventId: 'event-123', // preserved
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});

	it('preserves lastEventId on reset', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'important-event-id',
			attemptCount: 10,
			disconnectedAt: 1700000000000,
			lastAttemptAt: 1700000050000
		};

		const newState = resetReconnectionState(state);

		expect(newState.lastEventId).toBe('important-event-id');
	});

	it('resets state with null lastEventId', () => {
		const state: SSEReconnectionState = {
			lastEventId: null,
			attemptCount: 3,
			disconnectedAt: 1700000000000,
			lastAttemptAt: 1700000005000
		};

		const newState = resetReconnectionState(state);

		expect(newState).toEqual({
			lastEventId: null,
			attemptCount: 0,
			disconnectedAt: null,
			lastAttemptAt: null
		});
	});

	it('does not mutate original state', () => {
		const state: SSEReconnectionState = {
			lastEventId: 'event-123',
			attemptCount: 5,
			disconnectedAt: 1700000000000,
			lastAttemptAt: 1700000010000
		};

		const newState = resetReconnectionState(state);

		expect(state.attemptCount).toBe(5);
		expect(state.disconnectedAt).toBe(1700000000000);
		expect(newState.attemptCount).toBe(0);
	});
});

describe('SSEReconnectionError', () => {
	it('has correct name', () => {
		const err = new SSEReconnectionError('test error');
		expect(err.name).toBe('SSEReconnectionError');
	});

	it('has correct message', () => {
		const err = new SSEReconnectionError('Attempt count cannot be negative');
		expect(err.message).toBe('Attempt count cannot be negative');
	});

	it('inherits from Error properly', () => {
		const err = new SSEReconnectionError('test message');
		expect(err).toBeInstanceOf(SSEReconnectionError);
		expect(err.stack).toMatch(/SSEReconnectionError: test message/);
		expect(Object.getPrototypeOf(Object.getPrototypeOf(err))).toBe(Error.prototype);
	});
});

describe('createDefaultConfig', () => {
	it('creates config with correct default values', () => {
		const config = createDefaultConfig();

		expect(config).toEqual({
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			fullRefreshThresholdMs: 300000,
			backoffMultiplier: 2
		});
	});

	it('creates config that works with calculateBackoff', () => {
		const config = createDefaultConfig();

		// Test exponential sequence: 1s -> 2s -> 4s -> 8s
		expect(calculateBackoff(0, config)).toBe(1000);
		expect(calculateBackoff(1, config)).toBe(2000);
		expect(calculateBackoff(2, config)).toBe(4000);
		expect(calculateBackoff(3, config)).toBe(8000);
	});

	it('creates config that caps at maxDelayMs', () => {
		const config = createDefaultConfig();

		// 2^5 * 1000 = 32000 > 30000
		expect(calculateBackoff(5, config)).toBe(30000);
	});
});

describe('SSEStateUpdateEvent type', () => {
	it('allows attempt event', () => {
		const event: SSEStateUpdateEvent = { type: 'attempt' };
		expect(event.type).toBe('attempt');
	});

	it('allows disconnect event', () => {
		const event: SSEStateUpdateEvent = { type: 'disconnect' };
		expect(event.type).toBe('disconnect');
	});

	it('allows event with eventId', () => {
		const event: SSEStateUpdateEvent = { type: 'event', eventId: 'evt-123' };
		expect(event.type).toBe('event');
		expect(event.eventId).toBe('evt-123');
	});

	it('allows event without eventId', () => {
		const event: SSEStateUpdateEvent = { type: 'event' };
		expect(event.type).toBe('event');
	});
});
