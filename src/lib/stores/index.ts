/**
 * Stores Module - Main Entry Point
 *
 * Re-exports all stores for backwards compatibility.
 * New code should prefer importing from core/ or domains/ directly.
 */

// ============================================================================
// CORE STORES (Infrastructure)
// ============================================================================

// Network state (legacy simple implementation)
export { networkState, type QueuedAction } from './network.svelte';

// Toast notifications
export { toastStore, type Toast, type ToastType, type ToastOptions } from './toast.svelte';

// Theme
export { themeStore, type Theme } from './theme.svelte';

// WebSocket client
export {
	wsClient,
	createWebSocketClient,
	type ConnectionState,
	type MessageType,
	type WSMessage,
	type AgentStatusPayload,
	type LogEntryPayload,
	type QueueUpdatePayload,
	type WorkflowUpdatePayload
} from './websocket.svelte';

// Data synchronization
export {
	syncStore,
	createSyncStore,
	useSyncStatus,
	type SyncStatus,
	type VersionedData,
	type SyncOperation,
	type PendingSyncItem,
	type SyncEvent,
	type ConflictStrategy
} from './sync.svelte';

// Multi-tier polling system
export {
	pollingManager,
	usePolling,
	getPolling,
	removePolling,
	createMultiTierPolling,
	POLLING_TIERS,
	POLLING_JITTER,
	addJitter,
	type ResourceState,
	type PollingConfig
} from './polling.svelte';

// Operations tracking
export {
	operationsStore,
	trackOperation,
	trackBatchOperation,
	type Operation,
	type OperationStatus,
	type OperationPriority,
	type OperationType,
	type OperationGroup,
	type CreateOperationConfig,
	type UpdateOperationOptions
} from './operations.svelte';

// SWR Cache
export {
	swrCache,
	createSWRCache,
	CACHE_KEYS,
	CACHE_TTLS,
	type CacheEntry,
	type CacheConfig,
	type SWROptions
} from './swr';

// Server-Sent Events
export {
	sseStore,
	useSSE,
	type SSEConnectionState,
	type SSEEvent,
	type SSEEventType
} from './sse.svelte';

// ============================================================================
// DOMAIN STORES (Business Entities)
// ============================================================================

// Work (beads/issues)
export {
	workStore,
	useWork,
	type WorkItem,
	type WorkFilter
} from './work.svelte';

// Convoys
export {
	convoysStore,
	useConvoys,
	type Convoy,
	type ConvoyStatus,
	type ConvoyFilter
} from './convoys.svelte';

// Agents (polecats)
export {
	agentsStore,
	useAgents,
	type Agent,
	type AgentStatus,
	type AgentFilter
} from './agents.svelte';

// Mail
export {
	mailStore,
	useMail,
	type MailItem,
	type MailPriority,
	type MailStatus,
	type MailType,
	type MailFilter
} from './mail.svelte';

// Rigs
export {
	rigsStore,
	useRigs,
	type Rig,
	type RigAgent,
	type RigConfig,
	type RigStatus,
	type RigFilter
} from './rigs.svelte';

// Merge Queue
export {
	queueStore,
	useQueue,
	type MergeQueueItem,
	type MergeQueueStatus,
	type MergeQueueCloseReason,
	type MergeQueueFailureType,
	type CIStatus,
	type MergeableStatus,
	type QueueFilter
} from './queue.svelte';

// Search index with Fuse.js
export {
	searchIndex,
	useSearchIndex,
	type SearchableItem,
	type SearchableType
} from './search-index.svelte';
