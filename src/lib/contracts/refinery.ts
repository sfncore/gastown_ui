/**
 * Refinery/MR Contract - Status Lifecycle, Close Reasons, Failure Types
 *
 * MR (Merge Request) status lifecycle: open -> in_progress -> closed
 * NOTE: 'merged' is a CloseReason, NOT a status.
 *
 * Source of truth: internal/refinery/types.go
 */

// =============================================================================
// MR Status (lifecycle state)
// =============================================================================

/**
 * MR status lifecycle:
 * - 'open': Queued, waiting to be processed
 * - 'in_progress': Currently being merged/tested by refinery
 * - 'closed': Done (check close_reason for outcome)
 */
export type MRStatus = 'open' | 'in_progress' | 'closed';

export const MR_STATUSES: readonly MRStatus[] = ['open', 'in_progress', 'closed'] as const;

const VALID_STATUSES = new Set<string>(MR_STATUSES);

export function isValidMRStatus(value: string): value is MRStatus {
	return VALID_STATUSES.has(value);
}

// =============================================================================
// Close Reasons (WHY the MR was closed)
// =============================================================================

/**
 * Close reasons (only relevant when status='closed'):
 * - 'merged': Successfully merged to main
 * - 'rejected': Rejected by review or tests
 * - 'conflict': Could not resolve merge conflicts
 * - 'superseded': Replaced by newer MR
 */
export type MRCloseReason = 'merged' | 'rejected' | 'conflict' | 'superseded';

export const MR_CLOSE_REASONS: readonly MRCloseReason[] = [
	'merged',
	'rejected',
	'conflict',
	'superseded'
] as const;

const VALID_CLOSE_REASONS = new Set<string>(MR_CLOSE_REASONS);

export function isValidMRCloseReason(value: string): value is MRCloseReason {
	return VALID_CLOSE_REASONS.has(value);
}

// =============================================================================
// Failure Types (error handling)
// =============================================================================

/**
 * Failure types for error handling:
 * - 'conflict': Merge conflict
 * - 'tests_fail': Test suite failed
 * - 'build_fail': Build failed
 * - 'flaky_test': Intermittent test failure
 * - 'push_fail': Could not push to remote
 * - 'fetch_fail': Could not fetch from remote
 * - 'checkout_fail': Could not checkout branch
 */
export type MRFailureType =
	| 'conflict'
	| 'tests_fail'
	| 'build_fail'
	| 'flaky_test'
	| 'push_fail'
	| 'fetch_fail'
	| 'checkout_fail';

export const MR_FAILURE_TYPES: readonly MRFailureType[] = [
	'conflict',
	'tests_fail',
	'build_fail',
	'flaky_test',
	'push_fail',
	'fetch_fail',
	'checkout_fail'
] as const;

const VALID_FAILURE_TYPES = new Set<string>(MR_FAILURE_TYPES);

export function isValidMRFailureType(value: string): value is MRFailureType {
	return VALID_FAILURE_TYPES.has(value);
}
