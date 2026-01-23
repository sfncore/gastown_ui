/**
 * Tests for address normalization utilities
 * Implements Postel's Law: "Be liberal in what you accept, conservative in what you send"
 */

import { describe, it, expect } from 'vitest';
import { normalizeAddress, formatDisplayAddress, isValidAddress } from './address';

describe('normalizeAddress', () => {
	describe('overseer (human operator)', () => {
		it('normalizes overseer without slash', () => {
			expect(normalizeAddress('overseer')).toBe('overseer');
		});

		it('removes trailing slash from overseer/', () => {
			expect(normalizeAddress('overseer/')).toBe('overseer');
		});
	});

	describe('town-level agents', () => {
		it('adds trailing slash to mayor', () => {
			expect(normalizeAddress('mayor')).toBe('mayor/');
		});

		it('keeps trailing slash on mayor/', () => {
			expect(normalizeAddress('mayor/')).toBe('mayor/');
		});

		it('adds trailing slash to deacon', () => {
			expect(normalizeAddress('deacon')).toBe('deacon/');
		});

		it('adds trailing slash to witness', () => {
			expect(normalizeAddress('witness')).toBe('witness/');
		});
	});

	describe('polecat normalization', () => {
		it('normalizes rig/polecats/Name to rig/Name', () => {
			expect(normalizeAddress('gastown/polecats/Toast')).toBe('gastown/Toast');
		});

		it('preserves canonical polecat address', () => {
			expect(normalizeAddress('gastown/Toast')).toBe('gastown/Toast');
		});

		it('normalizes deep polecat paths', () => {
			expect(normalizeAddress('myrig/polecats/furiosa')).toBe('myrig/furiosa');
		});
	});

	describe('crew normalization', () => {
		it('normalizes rig/crew/Name to rig/Name', () => {
			expect(normalizeAddress('gastown/crew/yourname')).toBe('gastown/yourname');
		});

		it('preserves canonical crew address', () => {
			expect(normalizeAddress('gastown/yourname')).toBe('gastown/yourname');
		});
	});

	describe('rig broadcast', () => {
		it('removes trailing slash from rig/', () => {
			expect(normalizeAddress('gastown/')).toBe('gastown');
		});

		it('preserves rig without slash', () => {
			expect(normalizeAddress('gastown')).toBe('gastown');
		});
	});

	describe('edge cases', () => {
		it('handles empty string', () => {
			expect(normalizeAddress('')).toBe('');
		});

		it('handles whitespace-only', () => {
			expect(normalizeAddress('  ')).toBe('');
		});

		it('trims whitespace', () => {
			expect(normalizeAddress(' gastown/Toast ')).toBe('gastown/Toast');
		});
	});
});

describe('formatDisplayAddress', () => {
	it('extracts last segment from polecat address', () => {
		expect(formatDisplayAddress('gastown/Toast')).toBe('Toast');
	});

	it('extracts last segment from deep path', () => {
		expect(formatDisplayAddress('gastown/polecats/furiosa')).toBe('furiosa');
	});

	it('returns overseer as-is', () => {
		expect(formatDisplayAddress('overseer')).toBe('overseer');
	});

	it('removes trailing slash from mayor/', () => {
		expect(formatDisplayAddress('mayor/')).toBe('mayor');
	});

	it('handles empty string', () => {
		expect(formatDisplayAddress('')).toBe('');
	});
});

describe('isValidAddress', () => {
	it('returns true for valid overseer', () => {
		expect(isValidAddress('overseer')).toBe(true);
	});

	it('returns true for valid polecat address', () => {
		expect(isValidAddress('gastown/Toast')).toBe(true);
	});

	it('returns true for town-level agents', () => {
		expect(isValidAddress('mayor/')).toBe(true);
		expect(isValidAddress('deacon/')).toBe(true);
	});

	it('returns false for empty string', () => {
		expect(isValidAddress('')).toBe(false);
	});

	it('returns false for whitespace-only', () => {
		expect(isValidAddress('   ')).toBe(false);
	});
});
