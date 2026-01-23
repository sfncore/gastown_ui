/**
 * Gastown Contracts - Canonical Domain Contract Definitions
 *
 * This module provides the source of truth for all gastown domain types:
 * - Storage vs Display status patterns
 * - Validation functions
 * - Constants for valid values
 *
 * @example
 * ```typescript
 * import {
 *   BEAD_STORAGE_STATUSES,
 *   isValidBeadStorageStatus,
 *   type BeadStorageStatus
 * } from '$lib/contracts';
 * ```
 */

// =============================================================================
// Bead Contract
// =============================================================================

export {
	BEAD_STORAGE_STATUSES,
	BEAD_DISPLAY_STATUSES,
	isValidBeadStorageStatus,
	isValidBeadDisplayStatus,
	type BeadStorageStatus,
	type BeadDisplayStatus
} from './bead';

// =============================================================================
// Mail Contract
// =============================================================================

export {
	MAIL_PRIORITIES,
	MAIL_TYPES,
	MAIL_DELIVERY_MODES,
	isValidMailPriority,
	isValidMailType,
	isValidMailDelivery,
	isValidMailAddress,
	type MailPriority,
	type MailType,
	type MailDelivery
} from './mail';

// =============================================================================
// Polecat Contract
// =============================================================================

export {
	POLECAT_STATES,
	POLECAT_DISPLAY_STATUSES,
	isValidPolecatState,
	isValidPolecatDisplayStatus,
	polecatStateToDisplayStatus,
	type PolecatState,
	type PolecatDisplayStatus
} from './polecat';

// =============================================================================
// Refinery Contract
// =============================================================================

export {
	MR_STATUSES,
	MR_CLOSE_REASONS,
	MR_FAILURE_TYPES,
	isValidMRStatus,
	isValidMRCloseReason,
	isValidMRFailureType,
	type MRStatus,
	type MRCloseReason,
	type MRFailureType
} from './refinery';

// =============================================================================
// Convoy Contract
// =============================================================================

export {
	CONVOY_STORAGE_STATUSES,
	CONVOY_WORK_STATUSES,
	isValidConvoyStorageStatus,
	isValidConvoyWorkStatus,
	type ConvoyStorageStatus,
	type ConvoyWorkStatus
} from './convoy';
