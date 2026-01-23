/**
 * SSE Reconnection Utilities
 *
 * Provides exponential backoff and state tracking for SSE reconnection.
 * Supports last-event-ID tracking for resumable streams.
 */

/**
 * Error thrown when SSE reconnection parameters are invalid.
 */
export class SSEReconnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SSEReconnectionError';
	}
}

/**
 * Configuration for SSE reconnection behavior.
 *
 * @property initialDelayMs - Starting delay before first retry (default: 1000ms)
 * @property maxDelayMs - Maximum delay cap (default: 30000ms)
 * @property fullRefreshThresholdMs - Time after which full refresh is needed (default: 300000ms / 5 min)
 * @property backoffMultiplier - Multiplier for exponential backoff (default: 2)
 */
export interface SSEReconnectionConfig {
	readonly initialDelayMs: number;
	readonly maxDelayMs: number;
	readonly fullRefreshThresholdMs: number;
	readonly backoffMultiplier?: number;
}

/**
 * State tracking for SSE reconnection attempts.
 *
 * @property lastEventId - Last received event ID for resumable streams
 * @property attemptCount - Number of reconnection attempts since last success
 * @property disconnectedAt - Timestamp when connection was lost
 * @property lastAttemptAt - Timestamp of last reconnection attempt
 */
export interface SSEReconnectionState {
	readonly lastEventId: string | null;
	readonly attemptCount: number;
	readonly disconnectedAt: number | null;
	readonly lastAttemptAt: number | null;
}

/**
 * Event types for state updates.
 */
export type SSEStateUpdateEvent =
	| { readonly type: 'attempt' }
	| { readonly type: 'disconnect' }
	| { readonly type: 'event'; readonly eventId?: string };

/** Default backoff multiplier for exponential backoff */
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Creates a default SSE reconnection configuration.
 *
 * Defaults:
 * - initialDelayMs: 1000 (1 second)
 * - maxDelayMs: 30000 (30 seconds)
 * - fullRefreshThresholdMs: 300000 (5 minutes)
 * - backoffMultiplier: 2
 */
export function createDefaultConfig(): SSEReconnectionConfig {
	return {
		initialDelayMs: 1000,
		maxDelayMs: 30000,
		fullRefreshThresholdMs: 300000,
		backoffMultiplier: DEFAULT_BACKOFF_MULTIPLIER
	};
}

/**
 * Calculate exponential backoff delay for reconnection attempt.
 *
 * Uses formula: initialDelay * (multiplier ^ attemptCount)
 * Result is capped at maxDelayMs.
 *
 * @example
 * // With default config (multiplier=2, initial=1000, max=30000):
 * calculateBackoff(0, config) // 1000ms
 * calculateBackoff(1, config) // 2000ms
 * calculateBackoff(2, config) // 4000ms
 * calculateBackoff(3, config) // 8000ms
 * calculateBackoff(5, config) // 30000ms (capped)
 *
 * @throws {SSEReconnectionError} If attemptCount is negative
 * @throws {SSEReconnectionError} If initialDelayMs is not positive
 * @throws {SSEReconnectionError} If maxDelayMs is not positive
 */
export function calculateBackoff(attemptCount: number, config: SSEReconnectionConfig): number {
	if (attemptCount < 0) {
		throw new SSEReconnectionError('Attempt count cannot be negative');
	}
	if (config.initialDelayMs <= 0) {
		throw new SSEReconnectionError('Initial delay must be positive');
	}
	if (config.maxDelayMs <= 0) {
		throw new SSEReconnectionError('Max delay must be positive');
	}

	const multiplier = config.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
	const delay = config.initialDelayMs * Math.pow(multiplier, attemptCount);

	return Math.min(delay, config.maxDelayMs);
}

/**
 * Determine if a full refresh is needed based on disconnect duration.
 *
 * Returns true if the connection has been disconnected for longer than
 * the configured threshold (default: 5 minutes). A full refresh means
 * the client should fetch all data instead of relying on the last-event-ID.
 *
 * @param state - Current reconnection state
 * @param config - Reconnection configuration
 * @param now - Optional current timestamp for testing (defaults to Date.now())
 * @throws {SSEReconnectionError} If fullRefreshThresholdMs is not positive
 */
export function shouldFullRefresh(
	state: SSEReconnectionState,
	config: SSEReconnectionConfig,
	now?: number
): boolean {
	if (config.fullRefreshThresholdMs <= 0) {
		throw new SSEReconnectionError('Full refresh threshold must be positive');
	}

	if (state.disconnectedAt === null) {
		return false;
	}

	const currentTime = now ?? Date.now();
	const elapsed = currentTime - state.disconnectedAt;

	return elapsed >= config.fullRefreshThresholdMs;
}

/**
 * Create initial reconnection state.
 *
 * @param lastEventId - Optional last event ID from previous session
 */
export function createReconnectionState(lastEventId?: string): SSEReconnectionState {
	return {
		lastEventId: lastEventId ?? null,
		attemptCount: 0,
		disconnectedAt: null,
		lastAttemptAt: null
	};
}

/**
 * Update reconnection state based on event type.
 *
 * Event types:
 * - 'attempt': Increment attempt count and record timestamp
 * - 'disconnect': Record disconnect timestamp (only if not already set)
 * - 'event': Update last event ID if provided
 *
 * Returns a new state object (immutable update).
 *
 * @param state - Current reconnection state
 * @param event - State update event
 * @param now - Optional current timestamp for testing (defaults to Date.now())
 */
export function updateReconnectionState(
	state: SSEReconnectionState,
	event: SSEStateUpdateEvent,
	now?: number
): SSEReconnectionState {
	const currentTime = now ?? Date.now();

	switch (event.type) {
		case 'attempt':
			return {
				...state,
				attemptCount: state.attemptCount + 1,
				lastAttemptAt: currentTime
			};

		case 'disconnect':
			return {
				...state,
				disconnectedAt: state.disconnectedAt ?? currentTime
			};

		case 'event':
			return {
				...state,
				lastEventId: event.eventId ?? state.lastEventId
			};

		default:
			return state;
	}
}

/**
 * Reset reconnection state after successful reconnect.
 *
 * Preserves the lastEventId but resets attempt count and timestamps.
 * Call this when a connection is successfully established.
 */
export function resetReconnectionState(state: SSEReconnectionState): SSEReconnectionState {
	return {
		lastEventId: state.lastEventId,
		attemptCount: 0,
		disconnectedAt: null,
		lastAttemptAt: null
	};
}
