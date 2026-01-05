/**
 * API Client Module
 *
 * Type-safe HTTP client for REST API communication with:
 * - Bearer token authentication
 * - Automatic retries with exponential backoff
 * - Rate limiting
 * - Structured error handling
 */

// Types
export type {
	HttpMethod,
	ApiErrorCode,
	ApiError,
	ApiResponse,
	RequestOptions,
	ClientConfig,
	RateLimiterState,
	RetryContext
} from './types';

export { DEFAULT_CLIENT_CONFIG } from './types';

// Client
export { ApiClient, apiClient, createApiClient, isApiError } from './client';
