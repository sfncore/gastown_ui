/**
 * Polecat Contract - States (NO idle state!)
 *
 * CRITICAL: There is NO idle state. Polecats are ephemeral workers.
 * They spawn with work assigned, process it, and get nuked.
 *
 * Source of truth: internal/polecat/types.go
 */

// =============================================================================
// Polecat State (actual operational state)
// =============================================================================

/**
 * Polecat operational states:
 * - 'working': Actively processing assigned work
 * - 'done': Completed work, cleaning up (transient)
 * - 'stuck': Needs help, cannot proceed
 *
 * IMPORTANT: NO 'idle' state exists. Polecats don't wait for work.
 */
export type PolecatState = 'working' | 'done' | 'stuck';

export const POLECAT_STATES: readonly PolecatState[] = ['working', 'done', 'stuck'] as const;

const VALID_STATES = new Set<string>(POLECAT_STATES);

export function isValidPolecatState(value: string): value is PolecatState {
	return VALID_STATES.has(value);
}

// =============================================================================
// Display Status (for UI rendering)
// =============================================================================

/**
 * Display status derived from session state:
 * - 'running': Has active tmux session, state=working
 * - 'completing': state=done, cleaning up
 * - 'stuck': state=stuck, needs help
 * - 'exited': No session found
 */
export type PolecatDisplayStatus = 'running' | 'completing' | 'stuck' | 'exited';

export const POLECAT_DISPLAY_STATUSES: readonly PolecatDisplayStatus[] = [
	'running',
	'completing',
	'stuck',
	'exited'
] as const;

const VALID_DISPLAY = new Set<string>(POLECAT_DISPLAY_STATUSES);

export function isValidPolecatDisplayStatus(value: string): value is PolecatDisplayStatus {
	return VALID_DISPLAY.has(value);
}

// =============================================================================
// State to Display Mapping
// =============================================================================

const STATE_TO_DISPLAY: Record<PolecatState, PolecatDisplayStatus> = {
	working: 'running',
	done: 'completing',
	stuck: 'stuck'
};

export function polecatStateToDisplayStatus(state: PolecatState): PolecatDisplayStatus {
	if (!isValidPolecatState(state)) {
		throw new Error(`Invalid polecat state: ${state}`);
	}
	return STATE_TO_DISPLAY[state];
}
