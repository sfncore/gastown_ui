/**
 * Input Validation Schemas - Strict validation with Zod
 *
 * Architecture Decision: Validate inputs strictly, no character-stripping sanitization.
 * Reject invalid input with clear error messages instead of silently modifying.
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Bead ID: alphanumeric with hyphens/underscores, 1-64 chars
 * Examples: "gu-amx", "hq-m9x_2", "task-12345"
 */
export const BeadIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9_-]{1,64}$/, 'Invalid bead ID: must be 1-64 alphanumeric characters, hyphens, or underscores');

/**
 * Agent Name: starts with letter, alphanumeric with hyphens/underscores, 1-32 chars
 * Examples: "furiosa", "refinery", "mayor_1"
 */
export const AgentNameSchema = z
	.string()
	.regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/, 'Invalid agent name: must start with letter, 1-32 alphanumeric characters');

/**
 * Rig Name: starts with letter, alphanumeric with hyphens/underscores, 1-64 chars
 * Examples: "gastownui", "gastown-api", "my_rig_1"
 */
export const RigNameSchema = z
	.string()
	.regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/, 'Invalid rig name: must start with letter, 1-64 alphanumeric characters')
	.min(1, 'Rig name is required')
	.max(100, 'Rig name must be at most 100 characters');

// =============================================================================
// Composite Schemas
// =============================================================================

/**
 * Work item types supported by the system
 */
export const WorkItemTypeSchema = z.enum(['task', 'bug', 'feature', 'epic', 'chore']);
export type WorkItemType = z.infer<typeof WorkItemTypeSchema>;

/**
 * Label for categorizing work items
 */
export const LabelSchema = z.string().min(1, 'Label cannot be empty').max(50, 'Label must be at most 50 characters');

/**
 * Create Work Item: full validation for creating new beads
 */
export const CreateWorkItemSchema = z.object({
	title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
	description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
	priority: z
		.number()
		.int('Priority must be an integer')
		.min(0, 'Priority must be at least 0')
		.max(4, 'Priority must be at most 4'),
	labels: z.array(LabelSchema).max(10, 'At most 10 labels allowed').optional(),
	type: WorkItemTypeSchema.default('task'),
	assignee: AgentNameSchema.optional()
});
export type CreateWorkItem = z.infer<typeof CreateWorkItemSchema>;

/**
 * Git URL: HTTPS or SSH format for repository URLs
 * Examples: "https://github.com/org/repo.git", "git@github.com:org/repo.git"
 */
export const GitUrlSchema = z
	.string()
	.refine(
		(url) => {
			// HTTPS URL pattern
			if (url.startsWith('https://')) {
				try {
					new URL(url);
					return true;
				} catch {
					return false;
				}
			}
			// SSH URL pattern: git@host:path
			if (url.startsWith('git@')) {
				return /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9/_.-]+$/.test(url);
			}
			return false;
		},
		{ message: 'URL must use HTTPS or SSH protocol (e.g., https://github.com/org/repo or git@github.com:org/repo)' }
	);

/**
 * Add Rig: validation for registering a new rig
 */
export const AddRigSchema = z.object({
	name: RigNameSchema,
	url: GitUrlSchema
});
export type AddRig = z.infer<typeof AddRigSchema>;

/**
 * Sling Target: rig/agent format for work assignment
 * Examples: "gastownui/furiosa", "gastown-api/refinery"
 */
export const SlingTargetSchema = z
	.string()
	.regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'Target must be in rig/agent format (e.g., "gastownui/furiosa")');

/**
 * Sling: validation for slinging work to an agent
 */
export const SlingSchema = z.object({
	beadId: BeadIdSchema,
	target: SlingTargetSchema
});
export type Sling = z.infer<typeof SlingSchema>;

/**
 * Mail status filter options
 */
export const MailStatusSchema = z.enum(['open', 'closed', 'all']);
export type MailStatus = z.infer<typeof MailStatusSchema>;

/**
 * Mail priority filter options
 */
export const MailPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type MailPriority = z.infer<typeof MailPrioritySchema>;

/**
 * Mail type filter options
 */
export const MailTypeSchema = z.enum(['task', 'scavenge', 'notification', 'reply']);
export type MailType = z.infer<typeof MailTypeSchema>;

/**
 * Mail Filter: validation for filtering mail queries
 */
export const MailFilterSchema = z.object({
	status: MailStatusSchema.optional(),
	priority: MailPrioritySchema.optional(),
	type: MailTypeSchema.optional(),
	limit: z
		.number()
		.int('Limit must be an integer')
		.min(1, 'Limit must be at least 1')
		.max(100, 'Limit must be at most 100')
		.default(50)
});
export type MailFilter = z.infer<typeof MailFilterSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate and parse input, returning a result object
 * @param schema - Zod schema to validate against
 * @param input - Input to validate
 * @returns Object with success boolean, data (if valid), and error (if invalid)
 */
export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	input: unknown
): { success: true; data: T } | { success: false; error: string } {
	const result = schema.safeParse(input);
	if (result.success) {
		return { success: true, data: result.data };
	}
	// Format errors into a user-friendly message (Zod v4 uses .issues)
	const errorMessages = result.error.issues.map((e) => e.message).join('; ');
	return { success: false, error: errorMessages };
}

/**
 * Validate and throw on invalid input
 * @param schema - Zod schema to validate against
 * @param input - Input to validate
 * @throws Error with user-friendly message if validation fails
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
	const result = safeValidate(schema, input);
	if (!result.success) {
		throw new Error(`Validation failed: ${result.error}`);
	}
	return result.data;
}
