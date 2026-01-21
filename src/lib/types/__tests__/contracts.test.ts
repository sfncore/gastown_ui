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

import { describe } from 'vitest';
import {
	testCLIContract,
	testCLIArrayContract,
	testCLINullableContract
} from '../../test/contract-helper';
import {
	GtStatusSchema,
	BdBeadSchema,
	GtConvoyListItemSchema,
	GtMergeQueueItemSchema,
	GtMailMessageSchema
} from '../gastown.schema';
import { z } from 'zod';

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
