/**
 * Tests for status derivation utilities
 * Verifies the deriveDisplayStatus function correctly derives UI status from storage status
 */

import { describe, it, expect } from 'vitest';
import {
	deriveDisplayStatus,
	isBeadActionable,
	isBeadBlocked,
	type BeadStatusContext,
	type MRStatus
} from './status';

describe('deriveDisplayStatus', () => {
	describe('closed status', () => {
		it('returns closed for closed beads', () => {
			const bead: BeadStatusContext = { status: 'closed' };
			expect(deriveDisplayStatus(bead)).toBe('closed');
		});

		it('returns closed even if other flags are set', () => {
			const bead: BeadStatusContext = {
				status: 'closed',
				hook_bead: true,
				blocked_by_count: 5,
				assignee: 'someone'
			};
			expect(deriveDisplayStatus(bead)).toBe('closed');
		});
	});

	describe('hooked status', () => {
		it('returns hooked for beads with hook_bead=true', () => {
			const bead: BeadStatusContext = { status: 'open', hook_bead: true };
			expect(deriveDisplayStatus(bead)).toBe('hooked');
		});

		it('hooked takes precedence over blocked', () => {
			const bead: BeadStatusContext = {
				status: 'open',
				hook_bead: true,
				blocked_by_count: 3
			};
			expect(deriveDisplayStatus(bead)).toBe('hooked');
		});

		it('hooked takes precedence over in_progress', () => {
			const bead: BeadStatusContext = {
				status: 'open',
				hook_bead: true,
				assignee: 'someone'
			};
			expect(deriveDisplayStatus(bead)).toBe('hooked');
		});
	});

	describe('blocked status', () => {
		it('returns blocked for beads with blocked_by_count > 0', () => {
			const bead: BeadStatusContext = { status: 'open', blocked_by_count: 2 };
			expect(deriveDisplayStatus(bead)).toBe('blocked');
		});

		it('blocked takes precedence over in_progress', () => {
			const bead: BeadStatusContext = {
				status: 'open',
				blocked_by_count: 1,
				assignee: 'someone'
			};
			expect(deriveDisplayStatus(bead)).toBe('blocked');
		});

		it('returns open for blocked_by_count = 0', () => {
			const bead: BeadStatusContext = { status: 'open', blocked_by_count: 0 };
			expect(deriveDisplayStatus(bead)).toBe('open');
		});
	});

	describe('in_progress status', () => {
		it('returns in_progress for beads with assignee', () => {
			const bead: BeadStatusContext = { status: 'open', assignee: 'toast' };
			expect(deriveDisplayStatus(bead)).toBe('in_progress');
		});

		it('returns in_progress when MR is in_progress', () => {
			const bead: BeadStatusContext = { status: 'open' };
			const mrStatus: MRStatus = 'in_progress';
			expect(deriveDisplayStatus(bead, mrStatus)).toBe('in_progress');
		});

		it('returns in_progress when both assignee and MR', () => {
			const bead: BeadStatusContext = { status: 'open', assignee: 'nux' };
			const mrStatus: MRStatus = 'in_progress';
			expect(deriveDisplayStatus(bead, mrStatus)).toBe('in_progress');
		});
	});

	describe('open status (default)', () => {
		it('returns open for minimal open bead', () => {
			const bead: BeadStatusContext = { status: 'open' };
			expect(deriveDisplayStatus(bead)).toBe('open');
		});

		it('returns open when hook_bead is false', () => {
			const bead: BeadStatusContext = { status: 'open', hook_bead: false };
			expect(deriveDisplayStatus(bead)).toBe('open');
		});

		it('returns open when MR is not in_progress', () => {
			// MRStatus is now 'open' | 'in_progress' | 'closed'
			// 'merged' is a close_reason, not a status
			const bead: BeadStatusContext = { status: 'open' };
			expect(deriveDisplayStatus(bead, 'open')).toBe('open');
			expect(deriveDisplayStatus(bead, 'closed')).toBe('open');
		});
	});

	describe('edge cases', () => {
		it('handles undefined optional fields', () => {
			const bead: BeadStatusContext = { status: 'open' };
			expect(deriveDisplayStatus(bead)).toBe('open');
		});

		it('handles empty assignee string as not in_progress', () => {
			const bead: BeadStatusContext = { status: 'open', assignee: '' };
			expect(deriveDisplayStatus(bead)).toBe('open');
		});

		it('handles undefined MR status', () => {
			const bead: BeadStatusContext = { status: 'open' };
			expect(deriveDisplayStatus(bead, undefined)).toBe('open');
		});
	});
});

describe('isBeadActionable', () => {
	it('returns true for open beads', () => {
		expect(isBeadActionable({ status: 'open' })).toBe(true);
	});

	it('returns true for in_progress beads', () => {
		expect(isBeadActionable({ status: 'open', assignee: 'toast' })).toBe(true);
	});

	it('returns false for blocked beads', () => {
		expect(isBeadActionable({ status: 'open', blocked_by_count: 1 })).toBe(false);
	});

	it('returns false for closed beads', () => {
		expect(isBeadActionable({ status: 'closed' })).toBe(false);
	});

	it('returns false for hooked beads', () => {
		expect(isBeadActionable({ status: 'open', hook_bead: true })).toBe(false);
	});
});

describe('isBeadBlocked', () => {
	it('returns true for blocked beads', () => {
		expect(isBeadBlocked({ status: 'open', blocked_by_count: 2 })).toBe(true);
	});

	it('returns false for open beads', () => {
		expect(isBeadBlocked({ status: 'open' })).toBe(false);
	});

	it('returns false for closed beads', () => {
		expect(isBeadBlocked({ status: 'closed', blocked_by_count: 5 })).toBe(false);
	});
});
