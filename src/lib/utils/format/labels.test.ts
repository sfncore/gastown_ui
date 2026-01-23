/**
 * Tests for label metadata extraction utilities
 * Parses gastown label-based metadata from bead labels array
 */

import { describe, it, expect } from 'vitest';
import {
	extractMetadataFromLabels,
	extractLabelValue,
	hasLabel,
	type BeadMetadata,
	type GastownIssueType,
	GASTOWN_ISSUE_TYPES,
	isValidIssueType
} from './labels';

describe('extractLabelValue', () => {
	it('extracts value from prefixed label', () => {
		expect(extractLabelValue(['thread:abc123'], 'thread:')).toBe('abc123');
	});

	it('returns undefined when prefix not found', () => {
		expect(extractLabelValue(['other:value'], 'thread:')).toBeUndefined();
	});

	it('returns first match when multiple exist', () => {
		expect(extractLabelValue(['thread:first', 'thread:second'], 'thread:')).toBe('first');
	});

	it('handles empty labels array', () => {
		expect(extractLabelValue([], 'thread:')).toBeUndefined();
	});

	it('extracts from: sender', () => {
		expect(extractLabelValue(['from:mayor/'], 'from:')).toBe('mayor/');
	});

	it('extracts msg-type: value', () => {
		expect(extractLabelValue(['msg-type:HANDOFF'], 'msg-type:')).toBe('HANDOFF');
	});

	it('extracts queue: name', () => {
		expect(extractLabelValue(['queue:refinery'], 'queue:')).toBe('refinery');
	});

	it('extracts channel: name', () => {
		expect(extractLabelValue(['channel:broadcast'], 'channel:')).toBe('broadcast');
	});
});

describe('hasLabel', () => {
	it('returns true when label exists', () => {
		expect(hasLabel(['gt:merge-request', 'urgent'], 'gt:merge-request')).toBe(true);
	});

	it('returns false when label missing', () => {
		expect(hasLabel(['other'], 'gt:merge-request')).toBe(false);
	});

	it('returns false for empty array', () => {
		expect(hasLabel([], 'gt:merge-request')).toBe(false);
	});
});

describe('extractMetadataFromLabels', () => {
	it('detects merge request via gt:merge-request', () => {
		const metadata = extractMetadataFromLabels(['gt:merge-request']);
		expect(metadata.isMergeRequest).toBe(true);
	});

	it('detects agent via gt:agent', () => {
		const metadata = extractMetadataFromLabels(['gt:agent']);
		expect(metadata.isAgent).toBe(true);
	});

	it('extracts sender from from: label', () => {
		const metadata = extractMetadataFromLabels(['from:mayor/']);
		expect(metadata.sender).toBe('mayor/');
	});

	it('extracts threadId from thread: label', () => {
		const metadata = extractMetadataFromLabels(['thread:abc123']);
		expect(metadata.threadId).toBe('abc123');
	});

	it('extracts messageType from msg-type: label', () => {
		const metadata = extractMetadataFromLabels(['msg-type:ESCALATION']);
		expect(metadata.messageType).toBe('ESCALATION');
	});

	it('extracts queue from queue: label', () => {
		const metadata = extractMetadataFromLabels(['queue:refinery']);
		expect(metadata.queue).toBe('refinery');
	});

	it('extracts channel from channel: label', () => {
		const metadata = extractMetadataFromLabels(['channel:town']);
		expect(metadata.channel).toBe('town');
	});

	it('extracts multiple metadata fields', () => {
		const metadata = extractMetadataFromLabels([
			'gt:merge-request',
			'from:gastown/Toast',
			'thread:mr-123',
			'queue:refinery'
		]);
		expect(metadata.isMergeRequest).toBe(true);
		expect(metadata.sender).toBe('gastown/Toast');
		expect(metadata.threadId).toBe('mr-123');
		expect(metadata.queue).toBe('refinery');
	});

	it('returns empty metadata for empty labels', () => {
		const metadata = extractMetadataFromLabels([]);
		expect(metadata.isMergeRequest).toBeUndefined();
		expect(metadata.isAgent).toBeUndefined();
		expect(metadata.sender).toBeUndefined();
	});

	it('ignores non-metadata labels', () => {
		const metadata = extractMetadataFromLabels(['urgent', 'frontend', 'needs-review']);
		expect(metadata.isMergeRequest).toBeUndefined();
		expect(metadata.sender).toBeUndefined();
	});
});

describe('GASTOWN_ISSUE_TYPES', () => {
	it('includes all required types', () => {
		expect(GASTOWN_ISSUE_TYPES).toContain('task');
		expect(GASTOWN_ISSUE_TYPES).toContain('bug');
		expect(GASTOWN_ISSUE_TYPES).toContain('feature');
		expect(GASTOWN_ISSUE_TYPES).toContain('epic');
		expect(GASTOWN_ISSUE_TYPES).toContain('merge-request');
		expect(GASTOWN_ISSUE_TYPES).toContain('convoy');
		expect(GASTOWN_ISSUE_TYPES).toContain('agent');
		expect(GASTOWN_ISSUE_TYPES).toContain('gate');
		expect(GASTOWN_ISSUE_TYPES).toContain('message');
	});
});

describe('isValidIssueType', () => {
	it('returns true for valid issue types', () => {
		expect(isValidIssueType('task')).toBe(true);
		expect(isValidIssueType('bug')).toBe(true);
		expect(isValidIssueType('merge-request')).toBe(true);
		expect(isValidIssueType('convoy')).toBe(true);
	});

	it('returns false for invalid types', () => {
		expect(isValidIssueType('invalid')).toBe(false);
		expect(isValidIssueType('')).toBe(false);
		expect(isValidIssueType('TASK')).toBe(false);
	});
});
