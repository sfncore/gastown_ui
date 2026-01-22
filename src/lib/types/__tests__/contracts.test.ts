/**
 * Contract Tests - Golden Fixture Validation
 *
 * These tests validate that our Zod schemas correctly parse real CLI output.
 * Golden fixtures are captured from actual CLI commands and stored in
 * src/lib/test/fixtures/.
 *
 * If a test fails, it means either:
 * 1. The CLI output format changed (update the fixture with generate-fixtures.sh)
 * 2. The schema needs updating to match the new CLI format
 *
 * Run `scripts/generate-fixtures.sh` to refresh fixtures from current CLI output.
 *
 * @module contracts-test
 */

import { describe, it, expect } from 'vitest';
import {
	testCLIContract,
	testCLIArrayContract,
	testCLINullableContract,
	loadFixture
} from '../../test/contract-helper';
import {
	GtStatusSchema,
	BdBeadSchema,
	GtConvoyListItemSchema,
	GtMergeQueueItemSchema,
	GtMailMessageSchema,
	BdBeadStorageStatusSchema
} from '../gastown.schema';
import { z } from 'zod';
import { deriveDisplayStatus } from '../../utils/status';

// =============================================================================
// Status Contract Tests
// =============================================================================

describe('CLI Contract Tests', () => {
	// gt status --json
	testCLIContract('gt status --json', 'gt-status.json', GtStatusSchema);

	// bd list --json
	testCLIArrayContract('bd list --json', 'bd-list.json', BdBeadSchema, { minItems: 1 });

	// gt convoy list --json
	testCLIArrayContract('gt convoy list --json', 'gt-convoy-list.json', GtConvoyListItemSchema, {
		minItems: 1
	});

	// gt mq list --json (may return null for empty queue)
	testCLINullableContract(
		'gt mq list --json',
		'gt-mq-list.json',
		z.array(GtMergeQueueItemSchema).nullable()
	);

	// gt mail inbox --json (may return null for empty inbox)
	testCLINullableContract(
		'gt mail inbox --json',
		'gt-mail-inbox.json',
		z.array(GtMailMessageSchema).nullable()
	);
});

// =============================================================================
// Storage Status Contract Tests
// =============================================================================

describe('Storage Status Contract', () => {
	describe('BdBeadStorageStatusSchema', () => {
		it('accepts storage-only status values', () => {
			expect(BdBeadStorageStatusSchema.safeParse('open').success).toBe(true);
			expect(BdBeadStorageStatusSchema.safeParse('closed').success).toBe(true);
		});

		it('rejects display status values', () => {
			expect(BdBeadStorageStatusSchema.safeParse('hooked').success).toBe(false);
			expect(BdBeadStorageStatusSchema.safeParse('in_progress').success).toBe(false);
			expect(BdBeadStorageStatusSchema.safeParse('blocked').success).toBe(false);
		});
	});

	describe('Fixture Status Values', () => {
		it('bd-list fixture uses only storage status values', () => {
			const beads = loadFixture<{ status: string }[]>('bd-list.json');

			for (const bead of beads) {
				const result = BdBeadStorageStatusSchema.safeParse(bead.status);
				expect(result.success).toBe(true);
			}
		});

		it('bd-list fixture includes context fields for status derivation', () => {
			const beads = loadFixture<{
				status: string;
				hook_bead?: boolean;
				blocked_by_count?: number;
				assignee?: string | null;
			}[]>('bd-list.json');

			// All beads should have the context fields
			for (const bead of beads) {
				expect(typeof bead.hook_bead).toBe('boolean');
				expect(typeof bead.blocked_by_count).toBe('number');
			}
		});
	});

	describe('Display Status Derivation', () => {
		it('derives hooked status from context', () => {
			const beads = loadFixture<{
				status: string;
				hook_bead?: boolean;
				blocked_by_count?: number;
				assignee?: string | null;
			}[]>('bd-list.json');

			// Find a hooked bead
			const hookedBead = beads.find((b) => b.hook_bead === true);
			expect(hookedBead).toBeDefined();

			if (hookedBead) {
				const displayStatus = deriveDisplayStatus(hookedBead);
				expect(displayStatus).toBe('hooked');
			}
		});

		it('derives blocked status from context', () => {
			const beads = loadFixture<{
				status: string;
				hook_bead?: boolean;
				blocked_by_count?: number;
				assignee?: string | null;
			}[]>('bd-list.json');

			// Find a blocked bead
			const blockedBead = beads.find(
				(b) => (b.blocked_by_count ?? 0) > 0 && b.status === 'open'
			);
			expect(blockedBead).toBeDefined();

			if (blockedBead) {
				const displayStatus = deriveDisplayStatus(blockedBead);
				expect(displayStatus).toBe('blocked');
			}
		});

		it('derives closed status correctly', () => {
			const beads = loadFixture<{
				status: string;
				hook_bead?: boolean;
				blocked_by_count?: number;
				assignee?: string | null;
			}[]>('bd-list.json');

			// Find a closed bead
			const closedBead = beads.find((b) => b.status === 'closed');
			expect(closedBead).toBeDefined();

			if (closedBead) {
				const displayStatus = deriveDisplayStatus(closedBead);
				expect(displayStatus).toBe('closed');
			}
		});
	});
});
