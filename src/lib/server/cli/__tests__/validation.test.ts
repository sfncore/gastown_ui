import { describe, it, expect } from 'vitest';
import {
	BeadIdSchema,
	AgentNameSchema,
	RigNameSchema,
	CreateWorkItemSchema,
	AddRigSchema,
	SlingSchema,
	MailFilterSchema,
	safeValidate,
	validateOrThrow
} from '../validation';

describe('Validation Schemas', () => {
	describe('BeadIdSchema', () => {
		it('accepts valid bead IDs', () => {
			const validIds = ['gu-amx', 'hq-m9x', 'task_123', 'ABC-123', 'a', 'a'.repeat(64)];

			for (const id of validIds) {
				const result = BeadIdSchema.safeParse(id);
				expect(result.success, `Expected "${id}" to be valid`).toBe(true);
			}
		});

		it('rejects invalid bead IDs', () => {
			const invalidIds = [
				'', // empty
				'a'.repeat(65), // too long
				'has space', // spaces
				'has.dot', // dots
				'has@symbol', // special chars
				'has/slash' // slashes
			];

			for (const id of invalidIds) {
				const result = BeadIdSchema.safeParse(id);
				expect(result.success, `Expected "${id}" to be invalid`).toBe(false);
			}
		});

		it('provides user-friendly error messages', () => {
			const result = BeadIdSchema.safeParse('invalid@id');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('Invalid bead ID');
			}
		});
	});

	describe('AgentNameSchema', () => {
		it('accepts valid agent names', () => {
			const validNames = ['furiosa', 'refinery', 'mayor_1', 'Agent1', 'a', 'a'.repeat(32)];

			for (const name of validNames) {
				const result = AgentNameSchema.safeParse(name);
				expect(result.success, `Expected "${name}" to be valid`).toBe(true);
			}
		});

		it('rejects agent names starting with number', () => {
			const result = AgentNameSchema.safeParse('1agent');
			expect(result.success).toBe(false);
		});

		it('rejects agent names that are too long', () => {
			const result = AgentNameSchema.safeParse('a'.repeat(33));
			expect(result.success).toBe(false);
		});

		it('rejects agent names with invalid characters', () => {
			const invalidNames = ['has space', 'has.dot', 'has@symbol'];

			for (const name of invalidNames) {
				const result = AgentNameSchema.safeParse(name);
				expect(result.success, `Expected "${name}" to be invalid`).toBe(false);
			}
		});
	});

	describe('RigNameSchema', () => {
		it('accepts valid rig names', () => {
			const validNames = ['gastownui', 'gastown-api', 'my_rig_1', 'Rig123'];

			for (const name of validNames) {
				const result = RigNameSchema.safeParse(name);
				expect(result.success, `Expected "${name}" to be valid`).toBe(true);
			}
		});

		it('rejects rig names starting with number', () => {
			const result = RigNameSchema.safeParse('123rig');
			expect(result.success).toBe(false);
		});

		it('rejects empty rig names', () => {
			const result = RigNameSchema.safeParse('');
			expect(result.success).toBe(false);
		});
	});

	describe('CreateWorkItemSchema', () => {
		it('accepts valid work item', () => {
			const validItem = {
				title: 'Fix the bug',
				description: 'This bug needs fixing',
				priority: 1,
				labels: ['urgent', 'frontend'],
				type: 'bug' as const,
				assignee: 'furiosa'
			};

			const result = CreateWorkItemSchema.safeParse(validItem);
			expect(result.success).toBe(true);
		});

		it('accepts minimal work item', () => {
			const minimalItem = {
				title: 'Simple task',
				priority: 0
			};

			const result = CreateWorkItemSchema.safeParse(minimalItem);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.type).toBe('task'); // default value
			}
		});

		it('rejects empty title', () => {
			const item = {
				title: '',
				priority: 1
			};

			const result = CreateWorkItemSchema.safeParse(item);
			expect(result.success).toBe(false);
		});

		it('rejects title over 200 characters', () => {
			const item = {
				title: 'x'.repeat(201),
				priority: 1
			};

			const result = CreateWorkItemSchema.safeParse(item);
			expect(result.success).toBe(false);
		});

		it('rejects priority out of range', () => {
			const tooLow = { title: 'Test', priority: -1 };
			const tooHigh = { title: 'Test', priority: 5 };

			expect(CreateWorkItemSchema.safeParse(tooLow).success).toBe(false);
			expect(CreateWorkItemSchema.safeParse(tooHigh).success).toBe(false);
		});

		it('rejects non-integer priority', () => {
			const item = { title: 'Test', priority: 1.5 };

			const result = CreateWorkItemSchema.safeParse(item);
			expect(result.success).toBe(false);
		});

		it('rejects too many labels', () => {
			const item = {
				title: 'Test',
				priority: 1,
				labels: Array(11).fill('label')
			};

			const result = CreateWorkItemSchema.safeParse(item);
			expect(result.success).toBe(false);
		});

		it('rejects invalid type', () => {
			const item = {
				title: 'Test',
				priority: 1,
				type: 'invalid'
			};

			const result = CreateWorkItemSchema.safeParse(item);
			expect(result.success).toBe(false);
		});
	});

	describe('AddRigSchema', () => {
		it('accepts valid HTTPS URL', () => {
			const rig = {
				name: 'myrig',
				url: 'https://github.com/org/repo.git'
			};

			const result = AddRigSchema.safeParse(rig);
			expect(result.success).toBe(true);
		});

		it('accepts valid SSH URL', () => {
			const rig = {
				name: 'myrig',
				url: 'git@github.com:org/repo.git'
			};

			const result = AddRigSchema.safeParse(rig);
			expect(result.success).toBe(true);
		});

		it('rejects HTTP URL (non-secure)', () => {
			const rig = {
				name: 'myrig',
				url: 'http://github.com/org/repo.git'
			};

			const result = AddRigSchema.safeParse(rig);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('HTTPS or SSH');
			}
		});

		it('rejects invalid URL', () => {
			const rig = {
				name: 'myrig',
				url: 'not-a-url'
			};

			const result = AddRigSchema.safeParse(rig);
			expect(result.success).toBe(false);
		});
	});

	describe('SlingSchema', () => {
		it('accepts valid sling', () => {
			const sling = {
				beadId: 'gu-amx',
				target: 'gastownui/furiosa'
			};

			const result = SlingSchema.safeParse(sling);
			expect(result.success).toBe(true);
		});

		it('rejects invalid target format', () => {
			const invalidTargets = [
				'noSlash',
				'too/many/slashes',
				'UPPER/case',
				'/leading-slash',
				'trailing-slash/'
			];

			for (const target of invalidTargets) {
				const sling = { beadId: 'gu-amx', target };
				const result = SlingSchema.safeParse(sling);
				expect(result.success, `Expected target "${target}" to be invalid`).toBe(false);
			}
		});

		it('provides clear error for invalid target', () => {
			const sling = { beadId: 'gu-amx', target: 'invalid' };
			const result = SlingSchema.safeParse(sling);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('rig/agent format');
			}
		});
	});

	describe('MailFilterSchema', () => {
		it('accepts empty filter (uses defaults)', () => {
			const result = MailFilterSchema.safeParse({});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.limit).toBe(50); // default value
			}
		});

		it('accepts valid filter options', () => {
			const filter = {
				status: 'open' as const,
				priority: 'high' as const,
				type: 'task' as const,
				limit: 25
			};

			const result = MailFilterSchema.safeParse(filter);
			expect(result.success).toBe(true);
		});

		it('rejects invalid status', () => {
			const filter = { status: 'invalid' };
			const result = MailFilterSchema.safeParse(filter);
			expect(result.success).toBe(false);
		});

		it('rejects limit out of range', () => {
			const tooLow = { limit: 0 };
			const tooHigh = { limit: 101 };

			expect(MailFilterSchema.safeParse(tooLow).success).toBe(false);
			expect(MailFilterSchema.safeParse(tooHigh).success).toBe(false);
		});

		it('rejects non-integer limit', () => {
			const filter = { limit: 10.5 };
			const result = MailFilterSchema.safeParse(filter);
			expect(result.success).toBe(false);
		});
	});

	describe('safeValidate helper', () => {
		it('returns success with data for valid input', () => {
			const result = safeValidate(BeadIdSchema, 'valid-id');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('valid-id');
			}
		});

		it('returns error string for invalid input', () => {
			const result = safeValidate(BeadIdSchema, 'invalid@id');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('Invalid bead ID');
			}
		});

		it('joins multiple errors', () => {
			const result = safeValidate(CreateWorkItemSchema, { title: '', priority: -1 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain(';'); // multiple errors joined
			}
		});
	});

	describe('validateOrThrow helper', () => {
		it('returns data for valid input', () => {
			const data = validateOrThrow(BeadIdSchema, 'valid-id');
			expect(data).toBe('valid-id');
		});

		it('throws for invalid input', () => {
			expect(() => validateOrThrow(BeadIdSchema, 'invalid@id')).toThrow('Validation failed');
		});

		it('includes error details in thrown message', () => {
			expect(() => validateOrThrow(BeadIdSchema, 'invalid@id')).toThrow('Invalid bead ID');
		});
	});

	describe('No character stripping (strict validation)', () => {
		it('does not strip whitespace from bead ID', () => {
			const result = BeadIdSchema.safeParse(' bead-id ');
			expect(result.success).toBe(false); // Strict: reject, don't trim
		});

		it('does not strip special characters from agent name', () => {
			const result = AgentNameSchema.safeParse('agent@name');
			expect(result.success).toBe(false); // Strict: reject, don't strip @
		});

		it('does not modify input on validation', () => {
			const input = { title: '  Test Title  ', priority: 1 };
			const result = CreateWorkItemSchema.safeParse(input);
			expect(result.success).toBe(true);
			if (result.success) {
				// Title should remain as-is, not trimmed
				expect(result.data.title).toBe('  Test Title  ');
			}
		});
	});
});
