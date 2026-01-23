/**
 * Mail Contract - Priority, Types, Delivery Modes, Address Format
 *
 * Source of truth: internal/mail/types.go
 */

// =============================================================================
// Priority
// =============================================================================

export type MailPriority = 'urgent' | 'high' | 'normal' | 'low';

export const MAIL_PRIORITIES: readonly MailPriority[] = [
	'urgent',
	'high',
	'normal',
	'low'
] as const;

const VALID_PRIORITIES = new Set<string>(MAIL_PRIORITIES);

export function isValidMailPriority(value: string): value is MailPriority {
	return VALID_PRIORITIES.has(value);
}

// =============================================================================
// Message Types
// =============================================================================

export type MailType = 'task' | 'scavenge' | 'notification' | 'reply';

export const MAIL_TYPES: readonly MailType[] = [
	'task',
	'scavenge',
	'notification',
	'reply'
] as const;

const VALID_TYPES = new Set<string>(MAIL_TYPES);

export function isValidMailType(value: string): value is MailType {
	return VALID_TYPES.has(value);
}

// =============================================================================
// Delivery Modes
// =============================================================================

export type MailDelivery = 'queue' | 'interrupt';

export const MAIL_DELIVERY_MODES: readonly MailDelivery[] = ['queue', 'interrupt'] as const;

const VALID_DELIVERY = new Set<string>(MAIL_DELIVERY_MODES);

export function isValidMailDelivery(value: string): value is MailDelivery {
	return VALID_DELIVERY.has(value);
}

// =============================================================================
// Address Format
// =============================================================================

/**
 * Address Types (from CONTRACTS.md):
 * - Overseer: 'overseer' (no trailing slash)
 * - Town-level agent: '{agent}/' (trailing slash)
 * - Rig polecat: '{rig}/{polecat}'
 * - Rig crew: '{rig}/{member}'
 */

const TOWN_LEVEL_AGENTS = new Set(['mayor/', 'witness/', 'deacon/']);

export function isValidMailAddress(address: string): boolean {
	if (!address || address.length === 0) {
		return false;
	}

	// Overseer
	if (address === 'overseer') {
		return true;
	}

	// Town-level agents
	if (TOWN_LEVEL_AGENTS.has(address)) {
		return true;
	}

	// Rig/agent format: at least one slash, non-empty parts
	if (address.includes('/')) {
		const parts = address.split('/');
		// Filter out empty parts (handles trailing slashes)
		const nonEmpty = parts.filter((p) => p.length > 0);
		return nonEmpty.length >= 2;
	}

	return false;
}
