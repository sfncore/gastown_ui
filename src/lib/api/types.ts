/**
 * API Client Types
 *
 * Type definitions for the HTTP API client including request/response
 * types, error handling, and configuration options.
 */

/** HTTP methods supported by the client */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** API error codes for typed error handling */
export type ApiErrorCode =
	| 'NETWORK_ERROR'
	| 'TIMEOUT'
	| 'RATE_LIMITED'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'VALIDATION_ERROR'
	| 'SERVER_ERROR'
	| 'UNKNOWN';

/** Structured API error */
export interface ApiError {
	code: ApiErrorCode;
	message: string;
	status?: number;
	details?: Record<string, unknown>;
	retryable: boolean;
}

/** API response wrapper */
export interface ApiResponse<T> {
	data: T;
	status: number;
	headers: Headers;
}

/** Request configuration options */
export interface RequestOptions {
	/** Request headers */
	headers?: Record<string, string>;
	/** Query parameters */
	params?: Record<string, string | number | boolean | undefined>;
	/** Request body (auto-serialized to JSON) */
	body?: unknown;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Number of retry attempts for retryable errors */
	retries?: number;
	/** Skip authentication (for public endpoints) */
	skipAuth?: boolean;
	/** Custom abort signal */
	signal?: AbortSignal;
}

/** Client configuration */
export interface ClientConfig {
	/** Base URL for all requests */
	baseUrl: string;
	/** Default timeout in milliseconds */
	defaultTimeout: number;
	/** Default retry attempts */
	defaultRetries: number;
	/** Base delay for exponential backoff (ms) */
	retryBaseDelay: number;
	/** Maximum delay between retries (ms) */
	retryMaxDelay: number;
	/** Rate limit: requests per window */
	rateLimitRequests: number;
	/** Rate limit: window duration (ms) */
	rateLimitWindow: number;
	/** Bearer token provider (optional, for non-cookie auth) */
	getToken?: () => string | null | Promise<string | null>;
}

/** Default client configuration */
export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
	baseUrl: '',
	defaultTimeout: 30000,
	defaultRetries: 3,
	retryBaseDelay: 1000,
	retryMaxDelay: 10000,
	rateLimitRequests: 100,
	rateLimitWindow: 60000
};

/** Rate limiter state */
export interface RateLimiterState {
	requests: number[];
	blocked: boolean;
	resetTime: number | null;
}

/** Retry context for backoff calculation */
export interface RetryContext {
	attempt: number;
	maxAttempts: number;
	lastError: ApiError;
}
