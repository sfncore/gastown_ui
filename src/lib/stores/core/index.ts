/**
 * Core stores module
 *
 * Low-level, foundational stores that other modules depend on.
 */

export {
	// Network partition detection store
	networkStore,
	createNetworkStore,
	NetworkError,
	NetworkErrorCode,
	type NetworkErrorCodeType,
	type NetworkState,
	type NetworkStoreInstance,
	type NetworkStoreDeps,
	type QueuedRequest,
	type QueueRequestConfig,
	type HttpMethod,
	type StatusChangeCallback,
	type QueueProcessor
} from './network.svelte';

export {
	// Visibility store for background mode optimization
	visibilityStore,
	createVisibilityStore,
	NORMAL_POLLING_INTERVAL,
	BACKGROUND_POLLING_INTERVAL,
	type VisibilityStoreDeps,
	type VisibilityStoreInstance,
	type VisibilityChangeCallback
} from './visibility.svelte';
