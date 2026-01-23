/**
 * Convoy Contract - Storage vs Work Status
 *
 * Convoy storage status is 'open' | 'closed' (same as beads).
 * Work status is DERIVED from tracked issues, not stored.
 *
 * Source of truth: internal/convoy/types.go
 */

// =============================================================================
// Storage Status (what gastown stores)
// =============================================================================

export type ConvoyStorageStatus = 'open' | 'closed';

export const CONVOY_STORAGE_STATUSES: readonly ConvoyStorageStatus[] = [
	'open',
	'closed'
] as const;

const VALID_STORAGE = new Set<string>(CONVOY_STORAGE_STATUSES);

export function isValidConvoyStorageStatus(value: string): value is ConvoyStorageStatus {
	return VALID_STORAGE.has(value);
}

// =============================================================================
// Work Status (derived for UI presentation)
// =============================================================================

/**
 * Work status derivation rules (in precedence order):
 * 1. trackedIssues.length === 0 -> 'waiting'
 * 2. all issues closed -> 'complete'
 * 3. any issue has isStuck === true -> 'stuck'
 * 4. any issue has assignee -> 'active'
 * 5. hours since update > threshold -> 'stale'
 * 6. default -> 'active'
 */
export type ConvoyWorkStatus = 'active' | 'stale' | 'stuck' | 'waiting' | 'complete';

export const CONVOY_WORK_STATUSES: readonly ConvoyWorkStatus[] = [
	'active',
	'stale',
	'stuck',
	'waiting',
	'complete'
] as const;

const VALID_WORK = new Set<string>(CONVOY_WORK_STATUSES);

export function isValidConvoyWorkStatus(value: string): value is ConvoyWorkStatus {
	return VALID_WORK.has(value);
}
