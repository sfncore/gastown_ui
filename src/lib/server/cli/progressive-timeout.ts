/**
 * Progressive Timeout Strategy
 *
 * Implements adaptive timeout progression for CLI commands:
 * - Start with 30s, increase to 60s then 120s on retries
 * - Max timeout capped at 5 minutes (300s)
 * - Support for cancellation via AbortController
 *
 * Architecture Decision: Resilient CLI execution with adaptive timeouts
 *
 * Usage:
 * ```typescript
 * const result = await executeWithProgressiveTimeout(
 *   async (signal) => {
 *     return fetch('/api/slow', { signal });
 *   },
 *   { maxRetries: 2 }
 * );
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for progressive timeout behavior
 */
export interface ProgressiveTimeoutConfig {
	/** Initial timeout in milliseconds. Default: 30000 (30s) */
	readonly initialTimeout: number;
	/** Multiplier applied on each retry. Default: 2 */
	readonly multiplier: number;
	/** Maximum timeout in milliseconds. Default: 300000 (5 min) */
	readonly maxTimeout: number;
	/** Maximum number of retry attempts. Default: 3 */
	readonly maxRetries: number;
	/** Optional AbortSignal for external cancellation */
	readonly signal?: AbortSignal;
}

/**
 * Type for the async operation that will be executed with timeout
 */
export type TimeoutOperation<T> = (signal: AbortSignal) => Promise<T>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 *
 * Timeout progression: 30s -> 60s -> 120s -> 240s -> 300s (capped)
 */
export const DEFAULT_PROGRESSIVE_TIMEOUT_CONFIG: Readonly<
	Omit<ProgressiveTimeoutConfig, 'signal'>
> = Object.freeze({
	initialTimeout: 30_000, // 30 seconds
	multiplier: 2,
	maxTimeout: 300_000, // 5 minutes
	maxRetries: 3
});

// ============================================================================
// Errors
// ============================================================================

/**
 * Base class for progressive timeout errors
 */
export abstract class ProgressiveTimeoutError extends Error {
	abstract readonly name: string;
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends ProgressiveTimeoutError {
	readonly name = 'TimeoutError' as const;
	readonly timeoutMs: number;
	readonly attempt: number;

	constructor(timeoutMs: number, attempt: number) {
		super(`Operation timed out after ${timeoutMs}ms (attempt ${attempt})`);
		this.timeoutMs = timeoutMs;
		this.attempt = attempt;
		// Ensure proper prototype chain for instanceof checks
		Object.setPrototypeOf(this, TimeoutError.prototype);
	}
}

/**
 * Error thrown when max retries are exhausted
 */
export class MaxRetriesError extends ProgressiveTimeoutError {
	readonly name = 'MaxRetriesError' as const;
	readonly attempts: number;
	readonly totalTimeMs: number;

	constructor(attempts: number, totalTimeMs: number) {
		super(`Operation failed after ${attempts} attempts (total time: ${totalTimeMs}ms)`);
		this.attempts = attempts;
		this.totalTimeMs = totalTimeMs;
		Object.setPrototypeOf(this, MaxRetriesError.prototype);
	}
}

/**
 * Error thrown when operation is cancelled externally
 */
export class CancellationError extends ProgressiveTimeoutError {
	readonly name = 'CancellationError' as const;

	constructor(message: string = 'Operation cancelled') {
		super(message);
		Object.setPrototypeOf(this, CancellationError.prototype);
	}
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
	return error instanceof TimeoutError;
}

/**
 * Type guard for MaxRetriesError
 */
export function isMaxRetriesError(error: unknown): error is MaxRetriesError {
	return error instanceof MaxRetriesError;
}

/**
 * Type guard for CancellationError
 */
export function isCancellationError(error: unknown): error is CancellationError {
	return error instanceof CancellationError;
}

/**
 * Type guard for any ProgressiveTimeoutError
 */
export function isProgressiveTimeoutError(error: unknown): error is ProgressiveTimeoutError {
	return (
		error instanceof TimeoutError ||
		error instanceof MaxRetriesError ||
		error instanceof CancellationError
	);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error for invalid configuration
 */
class ConfigValidationError extends Error {
	readonly name = 'ConfigValidationError' as const;
}

/**
 * Validates and merges configuration with defaults
 */
function validateAndMergeConfig(
	config?: Partial<ProgressiveTimeoutConfig>
): Omit<ProgressiveTimeoutConfig, 'signal'> & { signal?: AbortSignal } {
	const merged = { ...DEFAULT_PROGRESSIVE_TIMEOUT_CONFIG, ...config };

	if (merged.initialTimeout <= 0) {
		throw new ConfigValidationError('initialTimeout must be positive');
	}
	if (merged.multiplier <= 1) {
		throw new ConfigValidationError('multiplier must be greater than 1');
	}
	if (merged.maxTimeout <= merged.initialTimeout) {
		throw new ConfigValidationError('maxTimeout must be greater than initialTimeout');
	}
	if (merged.maxRetries < 0) {
		throw new ConfigValidationError('maxRetries must be non-negative');
	}

	return merged;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate timeout for a given retry attempt
 *
 * Formula: min(initialTimeout * multiplier^attempt, maxTimeout)
 *
 * @param attempt - Zero-based attempt number (0 = first attempt)
 * @param config - Optional partial configuration
 * @returns Timeout in milliseconds
 * @throws Error if attempt is negative or non-integer
 *
 * @example
 * ```typescript
 * calculateTimeout(0) // 30000 (30s)
 * calculateTimeout(1) // 60000 (60s)
 * calculateTimeout(2) // 120000 (120s)
 * calculateTimeout(4) // 300000 (5min, capped)
 * ```
 */
export function calculateTimeout(
	attempt: number,
	config?: Partial<ProgressiveTimeoutConfig>
): number {
	// Validate attempt number
	if (attempt < 0) {
		throw new Error('Attempt number must be non-negative');
	}
	if (!Number.isInteger(attempt)) {
		throw new Error('Attempt number must be an integer');
	}

	const mergedConfig = validateAndMergeConfig(config);

	// Calculate timeout: initial * multiplier^attempt
	const calculatedTimeout =
		mergedConfig.initialTimeout * Math.pow(mergedConfig.multiplier, attempt);

	// Cap at maxTimeout
	return Math.min(calculatedTimeout, mergedConfig.maxTimeout);
}

/**
 * Execute an operation with progressive timeout and automatic retry
 *
 * On timeout, the operation is retried with an increased timeout value
 * until maxRetries is exhausted. Non-timeout errors are not retried.
 *
 * @param operation - Async function that receives an AbortSignal for cancellation
 * @param config - Optional partial configuration
 * @returns Promise resolving to operation result
 * @throws TimeoutError - If operation times out (internal use during retry)
 * @throws MaxRetriesError - If all retry attempts are exhausted
 * @throws CancellationError - If operation is cancelled via external signal
 * @throws Error - If operation throws a non-timeout error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await executeWithProgressiveTimeout(async (signal) => {
 *   const response = await fetch('/api/data', { signal });
 *   return response.json();
 * });
 *
 * // With custom config and external cancellation
 * const controller = new AbortController();
 * const result = await executeWithProgressiveTimeout(
 *   async (signal) => longRunningOperation(signal),
 *   {
 *     initialTimeout: 10000,
 *     maxRetries: 5,
 *     signal: controller.signal
 *   }
 * );
 * ```
 */
export async function executeWithProgressiveTimeout<T>(
	operation: TimeoutOperation<T>,
	config?: Partial<ProgressiveTimeoutConfig>
): Promise<T> {
	const mergedConfig = validateAndMergeConfig(config);
	let attempt = 0;
	let totalTimeMs = 0;

	// Main retry loop
	while (attempt <= mergedConfig.maxRetries) {
		const timeout = calculateTimeout(attempt, mergedConfig);
		totalTimeMs += timeout;

		// Create a fresh abort controller for this attempt
		const controller = new AbortController();

		// Link external signal to internal controller for cancellation propagation
		const externalAbortHandler = (): void => {
			controller.abort();
		};

		if (config?.signal) {
			if (config.signal.aborted) {
				throw new CancellationError('Operation cancelled before start');
			}
			config.signal.addEventListener('abort', externalAbortHandler, { once: true });
		}

		// Set up timeout to abort the operation
		const timeoutId = setTimeout(() => {
			controller.abort();
		}, timeout);

		try {
			const result = await operation(controller.signal);

			// Success - clean up and return
			clearTimeout(timeoutId);
			config?.signal?.removeEventListener('abort', externalAbortHandler);
			return result;
		} catch (error) {
			// Clean up timeout
			clearTimeout(timeoutId);
			config?.signal?.removeEventListener('abort', externalAbortHandler);

			// Check if externally cancelled
			if (config?.signal?.aborted) {
				throw new CancellationError('Operation cancelled');
			}

			// Check if this is a timeout (aborted by our timeout handler)
			const isTimeout = isTimeoutError(error) || controller.signal.aborted;

			if (isTimeout) {
				attempt++;
				if (attempt > mergedConfig.maxRetries) {
					throw new MaxRetriesError(attempt, totalTimeMs);
				}
				// Continue to next retry with increased timeout
				continue;
			}

			// Non-timeout error - don't retry, propagate immediately
			throw error;
		}
	}

	// Should not reach here, but handle edge case
	throw new MaxRetriesError(attempt, totalTimeMs);
}
