/**
 * Gas Town Zod Validation Schemas
 *
 * Runtime validation schemas for all CLI output types. These schemas
 * use passthrough() for forward compatibility with evolving CLI output.
 *
 * @module gastown-schemas
 */

import { z } from 'zod';

// =============================================================================
// Status Schemas
// =============================================================================

/** Overseer schema */
export const GtOverseerSchema = z
	.object({
		name: z.string(),
		email: z.string(),
		username: z.string(),
		source: z.string(),
		unread_mail: z.number()
	})
	.passthrough();

/** Daemon status schema */
export const GtDaemonStatusSchema = z
	.object({
		running: z.boolean(),
		pid: z.number().optional(),
		uptime: z.string().optional(),
		version: z.string()
	})
	.passthrough();

/** Agent status enum */
export const GtAgentStatusSchema = z.enum([
	'idle',
	'active',
	'busy',
	'parked',
	'stuck',
	'orphaned'
]);

/** Agent health enum */
export const GtAgentHealthSchema = z.enum(['healthy', 'warning', 'critical']);

/** Agent summary schema (in status response) */
export const GtAgentSummarySchema = z
	.object({
		name: z.string(),
		address: z.string(),
		session: z.string(),
		role: z.string(),
		running: z.boolean(),
		has_work: z.boolean(),
		state: GtAgentStatusSchema.optional(),
		unread_mail: z.number()
	})
	.passthrough();

/** Detailed agent schema */
export const GtAgentSchema = z
	.object({
		name: z.string(),
		id: z.string(),
		status: GtAgentStatusSchema,
		session_id: z.string(),
		rig: z.string(),
		worktree: z.string(),
		branch: z.string().optional(),
		last_activity: z.string(),
		last_activity_ago: z.string(),
		current_task: z.string().optional(),
		current_molecule: z.string().optional(),
		health: GtAgentHealthSchema
	})
	.passthrough();

/** Hook info schema */
export const GtHookInfoSchema = z
	.object({
		agent: z.string(),
		role: z.string(),
		has_work: z.boolean()
	})
	.passthrough();

/** Rig info schema (in status response) */
export const GtRigInfoSchema = z
	.object({
		name: z.string(),
		polecats: z.array(z.string()),
		polecat_count: z.number(),
		crews: z.array(z.string()),
		crew_count: z.number(),
		has_witness: z.boolean(),
		has_refinery: z.boolean(),
		hooks: z.array(GtHookInfoSchema),
		agents: z.array(GtAgentSummarySchema)
	})
	.passthrough();

/** Rig summary schema */
export const GtRigSummarySchema = z
	.object({
		name: z.string(),
		path: z.string(),
		agents: z.number(),
		active: z.number(),
		docked: z.boolean()
	})
	.passthrough();

/** Queue summary schema */
export const GtQueueSummarySchema = z
	.object({
		pending: z.number(),
		in_progress: z.number(),
		total: z.number()
	})
	.passthrough();

/** Overall status schema */
export const GtStatusSchema = z
	.object({
		name: z.string(),
		location: z.string(),
		overseer: GtOverseerSchema,
		agents: z.array(GtAgentSummarySchema),
		rigs: z.array(GtRigInfoSchema)
	})
	.passthrough();

// =============================================================================
// Convoy Schemas
// =============================================================================

/** Convoy work status enum */
export const GtConvoyWorkStatusSchema = z.enum([
	'complete',
	'active',
	'stale',
	'stuck',
	'waiting'
]);

/** Convoy status enum */
export const GtConvoyStatusSchema = z.enum(['open', 'closed']);

/** Tracked issue schema */
export const GtTrackedIssueSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		status: z.string(),
		assignee: z.string().optional(),
		priority: z.number()
	})
	.passthrough();

/** Convoy schema */
export const GtConvoySchema = z
	.object({
		id: z.string(),
		title: z.string(),
		description: z.string().optional(),
		status: GtConvoyStatusSchema,
		work_status: GtConvoyWorkStatusSchema,
		progress: z.string(),
		completed: z.number(),
		total: z.number(),
		created_at: z.string(),
		updated_at: z.string(),
		tracked_issues: z.array(GtTrackedIssueSchema)
	})
	.passthrough();

// =============================================================================
// Bead Schemas
// =============================================================================

/** Bead status enum */
export const BdBeadStatusSchema = z.enum(['open', 'in_progress', 'closed', 'hooked']);

/** Bead schema */
export const BdBeadSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		description: z.string(),
		status: BdBeadStatusSchema,
		priority: z.number(),
		issue_type: z.string(),
		assignee: z.string().optional(),
		created_at: z.string(),
		created_by: z.string(),
		updated_at: z.string(),
		labels: z.array(z.string()),
		ephemeral: z.boolean(),
		parent_id: z.string().optional(),
		children: z.array(z.string()).optional()
	})
	.passthrough();

// =============================================================================
// Mail Schemas
// =============================================================================

/** Mail priority enum */
export const GtMailPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

/** Mail type enum */
export const GtMailTypeSchema = z.enum(['task', 'scavenge', 'notification', 'reply']);

/** Mail delivery enum */
export const GtMailDeliverySchema = z.enum(['queue', 'interrupt']);

/** Mail message schema */
export const GtMailMessageSchema = z
	.object({
		id: z.string(),
		from: z.string(),
		to: z.string(),
		subject: z.string(),
		body: z.string(),
		timestamp: z.string(),
		read: z.boolean(),
		priority: GtMailPrioritySchema,
		type: GtMailTypeSchema,
		delivery: GtMailDeliverySchema,
		thread_id: z.string().optional(),
		reply_to: z.string().optional(),
		pinned: z.boolean(),
		wisp: z.boolean()
	})
	.passthrough();

// =============================================================================
// Queue Schemas
// =============================================================================

/** Merge queue status enum */
export const GtMergeQueueStatusSchema = z.enum(['pending', 'processing', 'merged', 'failed']);

/** CI status enum */
export const GtCIStatusSchema = z.enum(['pass', 'fail', 'pending']);

/** Mergeable status enum */
export const GtMergeableStatusSchema = z.enum(['ready', 'conflict', 'pending']);

/** Merge queue item schema */
export const GtMergeQueueItemSchema = z
	.object({
		id: z.string(),
		branch: z.string(),
		repo: z.string(),
		polecat: z.string(),
		rig: z.string(),
		status: GtMergeQueueStatusSchema,
		priority: z.number(),
		submitted_at: z.string(),
		ci_status: GtCIStatusSchema.optional(),
		mergeable: GtMergeableStatusSchema.optional()
	})
	.passthrough();

// =============================================================================
// Workflow Schemas
// =============================================================================

/** Formula param type enum */
export const GtFormulaParamTypeSchema = z.enum(['string', 'number', 'boolean']);

/** Formula step schema */
export const GtFormulaStepSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string().optional(),
		required: z.boolean()
	})
	.passthrough();

/** Formula param schema */
export const GtFormulaParamSchema = z
	.object({
		type: GtFormulaParamTypeSchema,
		required: z.boolean(),
		default: z.unknown().optional(),
		description: z.string().optional()
	})
	.passthrough();

/** Formula schema */
export const GtFormulaSchema = z
	.object({
		name: z.string(),
		description: z.string(),
		category: z.string(),
		steps: z.array(GtFormulaStepSchema),
		parameters: z.record(z.string(), GtFormulaParamSchema).optional()
	})
	.passthrough();

/** Molecule status enum */
export const GtMoleculeStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

/** Molecule step status enum */
export const GtMoleculeStepStatusSchema = z.enum([
	'pending',
	'running',
	'completed',
	'failed',
	'skipped'
]);

/** Molecule step schema */
export const GtMoleculeStepSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		status: GtMoleculeStepStatusSchema,
		started_at: z.string().optional(),
		completed_at: z.string().optional()
	})
	.passthrough();

/** Molecule schema */
export const GtMoleculeSchema = z
	.object({
		id: z.string(),
		formula: z.string(),
		status: GtMoleculeStatusSchema,
		current_step: z.string().optional(),
		steps: z.array(GtMoleculeStepSchema),
		started_at: z.string().optional(),
		completed_at: z.string().optional(),
		error: z.string().optional(),
		agent: z.string().optional()
	})
	.passthrough();

// =============================================================================
// Health Schemas
// =============================================================================

/** Overall health enum */
export const GtOverallHealthSchema = z.enum(['healthy', 'warning', 'critical']);

/** Check status enum */
export const GtCheckStatusSchema = z.enum(['pass', 'warn', 'fail']);

/** Health check schema */
export const GtHealthCheckSchema = z
	.object({
		name: z.string(),
		category: z.string(),
		status: GtCheckStatusSchema,
		message: z.string(),
		details: z.string().optional()
	})
	.passthrough();

/** Doctor result schema */
export const GtDoctorResultSchema = z
	.object({
		overall: GtOverallHealthSchema,
		checks: z.array(GtHealthCheckSchema),
		summary: z.object({
			passed: z.number(),
			warned: z.number(),
			failed: z.number(),
			total: z.number()
		})
	})
	.passthrough();

// =============================================================================
// Rig Schemas
// =============================================================================

/** Rig status enum */
export const GtRigStatusSchema = z.enum(['pending', 'cloning', 'active', 'parked', 'error']);

/** Rig agent schema */
export const GtRigAgentSchema = z
	.object({
		name: z.string(),
		role: z.string(),
		status: z.string()
	})
	.passthrough();

/** Rig config schema */
export const GtRigConfigSchema = z
	.object({
		main_branch: z.string(),
		work_branch_prefix: z.string(),
		auto_merge: z.boolean(),
		require_review: z.boolean()
	})
	.passthrough();

/** Detailed rig schema */
export const GtRigSchema = z
	.object({
		name: z.string(),
		path: z.string(),
		worktree_root: z.string(),
		branch: z.string(),
		remote: z.string(),
		agents: z.array(GtRigAgentSchema),
		config: GtRigConfigSchema,
		docked: z.boolean(),
		status: GtRigStatusSchema
	})
	.passthrough();

// =============================================================================
// Feed Schemas
// =============================================================================

/** Feed item type enum */
export const GtFeedItemTypeSchema = z.enum([
	'agent_status',
	'merge',
	'mail',
	'convoy',
	'error',
	'system'
]);

/** Feed severity enum */
export const GtFeedSeveritySchema = z.enum(['info', 'warning', 'error']);

/** Feed item schema */
export const GtFeedItemSchema = z
	.object({
		id: z.string(),
		type: GtFeedItemTypeSchema,
		timestamp: z.string(),
		title: z.string(),
		description: z.string().optional(),
		agent: z.string().optional(),
		rig: z.string().optional(),
		severity: GtFeedSeveritySchema
	})
	.passthrough();

// =============================================================================
// Sling Schemas
// =============================================================================

/** Sling target status enum */
export const GtSlingTargetStatusSchema = z.enum(['idle', 'busy', 'parked']);

/** Sling target schema */
export const SlingTargetSchema = z
	.object({
		rig: z.string(),
		agent: z.string(),
		status: GtSlingTargetStatusSchema,
		display: z.string()
	})
	.passthrough();

// =============================================================================
// Snapshot Schemas
// =============================================================================

/** Freshness metadata schema */
export const GtFreshnessSchema = z
	.object({
		fetchedAt: z.string(),
		ttlMs: z.number()
	})
	.passthrough();

/** Composite snapshot schema */
export const GtSnapshotSchema = z
	.object({
		status: GtStatusSchema,
		mailCount: z.number(),
		queueCount: z.number(),
		recentActivity: z.array(GtFeedItemSchema),
		freshness: GtFreshnessSchema
	})
	.passthrough();

// =============================================================================
// API Error Schemas
// =============================================================================

/** Error category enum */
export const ErrorCategorySchema = z.enum([
	'cli_error',
	'network_error',
	'timeout_error',
	'validation_error',
	'not_found',
	'unknown'
]);

/** API error response schema */
export const ApiErrorResponseSchema = z
	.object({
		error: z.object({
			code: z.string(),
			message: z.string(),
			category: ErrorCategorySchema,
			retryable: z.boolean(),
			details: z.record(z.string(), z.unknown()).optional()
		})
	})
	.passthrough();

// =============================================================================
// Type Inference Helpers
// =============================================================================

/** Infer TypeScript types from Zod schemas */
export type GtStatusInferred = z.infer<typeof GtStatusSchema>;
export type GtAgentInferred = z.infer<typeof GtAgentSchema>;
export type GtConvoyInferred = z.infer<typeof GtConvoySchema>;
export type BdBeadInferred = z.infer<typeof BdBeadSchema>;
export type GtMailMessageInferred = z.infer<typeof GtMailMessageSchema>;
export type GtMergeQueueItemInferred = z.infer<typeof GtMergeQueueItemSchema>;
export type GtFormulaInferred = z.infer<typeof GtFormulaSchema>;
export type GtMoleculeInferred = z.infer<typeof GtMoleculeSchema>;
export type GtDoctorResultInferred = z.infer<typeof GtDoctorResultSchema>;
export type GtRigInferred = z.infer<typeof GtRigSchema>;
export type GtFeedItemInferred = z.infer<typeof GtFeedItemSchema>;
export type GtSnapshotInferred = z.infer<typeof GtSnapshotSchema>;
