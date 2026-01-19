/**
 * Gas Town TypeScript Data Models
 *
 * Comprehensive type definitions for all CLI output types used across
 * the Gas Town UI. These types model the JSON output from gt and bd commands.
 *
 * @module gastown-types
 */

// =============================================================================
// Status Types
// =============================================================================

/** Overall Gas Town status response from `gt status --json` */
export interface GtStatus {
	name: string;
	location: string;
	overseer: GtOverseer;
	agents: GtAgentSummary[];
	rigs: GtRigInfo[];
}

/** Overseer (human user) information */
export interface GtOverseer {
	name: string;
	email: string;
	username: string;
	source: string;
	unread_mail: number;
}

/** Daemon status information */
export interface GtDaemonStatus {
	running: boolean;
	pid?: number;
	uptime?: string;
	version: string;
}

/** Agent status values */
export type GtAgentStatus = 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';

/** Agent health levels */
export type GtAgentHealth = 'healthy' | 'warning' | 'critical';

/** Agent summary in status response */
export interface GtAgentSummary {
	name: string;
	address: string;
	session: string;
	role: string;
	running: boolean;
	has_work: boolean;
	state?: GtAgentStatus;
	unread_mail: number;
}

/** Detailed agent information from `gt peek` or agent detail views */
export interface GtAgent {
	name: string;
	id: string;
	status: GtAgentStatus;
	session_id: string;
	rig: string;
	worktree: string;
	branch?: string;
	last_activity: string;
	last_activity_ago: string;
	current_task?: string;
	current_molecule?: string;
	health: GtAgentHealth;
}

/** Rig summary in status response */
export interface GtRigSummary {
	name: string;
	path: string;
	agents: number;
	active: number;
	docked: boolean;
}

/** Rig info with agents and hooks */
export interface GtRigInfo {
	name: string;
	polecats: string[];
	polecat_count: number;
	crews: string[];
	crew_count: number;
	has_witness: boolean;
	has_refinery: boolean;
	hooks: GtHookInfo[];
	agents: GtAgentSummary[];
}

/** Hook information for a rig */
export interface GtHookInfo {
	agent: string;
	role: string;
	has_work: boolean;
}

/** Queue summary information */
export interface GtQueueSummary {
	pending: number;
	in_progress: number;
	total: number;
}

// =============================================================================
// Convoy Types
// =============================================================================

/** Convoy work status values */
export type GtConvoyWorkStatus = 'complete' | 'active' | 'stale' | 'stuck' | 'waiting';

/** Convoy status values */
export type GtConvoyStatus = 'open' | 'closed';

/** Convoy (work group) from `gt convoy list` */
export interface GtConvoy {
	id: string;
	title: string;
	description?: string;
	status: GtConvoyStatus;
	work_status: GtConvoyWorkStatus;
	progress: string;
	completed: number;
	total: number;
	created_at: string;
	updated_at: string;
	tracked_issues: GtTrackedIssue[];
}

/** Tracked issue within a convoy */
export interface GtTrackedIssue {
	id: string;
	title: string;
	status: string;
	assignee?: string;
	priority: number;
}

// =============================================================================
// Bead Types
// =============================================================================

/** Bead status values */
export type BdBeadStatus = 'open' | 'in_progress' | 'closed' | 'hooked';

/** Bead (work item) from `bd list` or `bd show` */
export interface BdBead {
	id: string;
	title: string;
	description: string;
	status: BdBeadStatus;
	priority: number;
	issue_type: string;
	assignee?: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	labels: string[];
	ephemeral: boolean;
	parent_id?: string;
	children?: string[];
}

// =============================================================================
// Mail Types
// =============================================================================

/** Mail priority levels */
export type GtMailPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Mail message types */
export type GtMailType = 'task' | 'scavenge' | 'notification' | 'reply';

/** Mail delivery modes */
export type GtMailDelivery = 'queue' | 'interrupt';

/** Mail message from `gt mail inbox` */
export interface GtMailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: GtMailPriority;
	type: GtMailType;
	delivery: GtMailDelivery;
	thread_id?: string;
	reply_to?: string;
	pinned: boolean;
	wisp: boolean;
}

// =============================================================================
// Queue Types
// =============================================================================

/** Merge queue item status values */
export type GtMergeQueueStatus = 'pending' | 'processing' | 'merged' | 'failed';

/** CI status values */
export type GtCIStatus = 'pass' | 'fail' | 'pending';

/** Mergeable status values */
export type GtMergeableStatus = 'ready' | 'conflict' | 'pending';

/** Merge queue item from `gt mq list` */
export interface GtMergeQueueItem {
	id: string;
	branch: string;
	repo: string;
	polecat: string;
	rig: string;
	status: GtMergeQueueStatus;
	priority: number;
	submitted_at: string;
	ci_status?: GtCIStatus;
	mergeable?: GtMergeableStatus;
}

// =============================================================================
// Workflow Types
// =============================================================================

/** Formula parameter types */
export type GtFormulaParamType = 'string' | 'number' | 'boolean';

/** Formula from `gt formula list` */
export interface GtFormula {
	name: string;
	description: string;
	category: string;
	steps: GtFormulaStep[];
	parameters?: Record<string, GtFormulaParam>;
}

/** Formula step definition */
export interface GtFormulaStep {
	id: string;
	name: string;
	description?: string;
	required: boolean;
}

/** Formula parameter definition */
export interface GtFormulaParam {
	type: GtFormulaParamType;
	required: boolean;
	default?: unknown;
	description?: string;
}

/** Molecule status values */
export type GtMoleculeStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Molecule step status values */
export type GtMoleculeStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Molecule (running workflow instance) */
export interface GtMolecule {
	id: string;
	formula: string;
	status: GtMoleculeStatus;
	current_step?: string;
	steps: GtMoleculeStep[];
	started_at?: string;
	completed_at?: string;
	error?: string;
	agent?: string;
}

/** Molecule step progress */
export interface GtMoleculeStep {
	id: string;
	name: string;
	status: GtMoleculeStepStatus;
	started_at?: string;
	completed_at?: string;
}

// =============================================================================
// Health Types
// =============================================================================

/** Overall health status */
export type GtOverallHealth = 'healthy' | 'warning' | 'critical';

/** Individual check status */
export type GtCheckStatus = 'pass' | 'warn' | 'fail';

/** Doctor result from `gt doctor --json` */
export interface GtDoctorResult {
	overall: GtOverallHealth;
	checks: GtHealthCheck[];
	summary: {
		passed: number;
		warned: number;
		failed: number;
		total: number;
	};
}

/** Individual health check result */
export interface GtHealthCheck {
	name: string;
	category: string;
	status: GtCheckStatus;
	message: string;
	details?: string;
}

// =============================================================================
// Rig Types
// =============================================================================

/** Rig status values */
export type GtRigStatus = 'pending' | 'cloning' | 'active' | 'parked' | 'error';

/** Detailed rig information from `gt rig show` */
export interface GtRig {
	name: string;
	path: string;
	worktree_root: string;
	branch: string;
	remote: string;
	agents: GtRigAgent[];
	config: GtRigConfig;
	docked: boolean;
	status: GtRigStatus;
}

/** Rig agent information */
export interface GtRigAgent {
	name: string;
	role: string;
	status: string;
}

/** Rig configuration */
export interface GtRigConfig {
	main_branch: string;
	work_branch_prefix: string;
	auto_merge: boolean;
	require_review: boolean;
}

// =============================================================================
// Feed Types
// =============================================================================

/** Feed item types */
export type GtFeedItemType = 'agent_status' | 'merge' | 'mail' | 'convoy' | 'error' | 'system';

/** Feed item severity levels */
export type GtFeedSeverity = 'info' | 'warning' | 'error';

/** Feed item from activity stream */
export interface GtFeedItem {
	id: string;
	type: GtFeedItemType;
	timestamp: string;
	title: string;
	description?: string;
	agent?: string;
	rig?: string;
	severity: GtFeedSeverity;
}

// =============================================================================
// Sling Types
// =============================================================================

/** Sling target status */
export type GtSlingTargetStatus = 'idle' | 'busy' | 'parked';

/** Sling target for work assignment */
export interface SlingTarget {
	rig: string;
	agent: string;
	status: GtSlingTargetStatus;
	display: string;
}

// =============================================================================
// Snapshot Types (Composite)
// =============================================================================

/** Freshness metadata for cached responses */
export interface GtFreshness {
	fetchedAt: string;
	ttlMs: number;
}

/** Composite snapshot from `/api/gastown/snapshot` */
export interface GtSnapshot {
	status: GtStatus;
	mailCount: number;
	queueCount: number;
	recentActivity: GtFeedItem[];
	freshness: GtFreshness;
}

// =============================================================================
// API Error Types
// =============================================================================

/** Error categories for structured error handling */
export type ErrorCategory =
	| 'cli_error'
	| 'network_error'
	| 'timeout_error'
	| 'validation_error'
	| 'not_found'
	| 'unknown';

/** Structured API error response */
export interface ApiErrorResponse {
	error: {
		code: string;
		message: string;
		category: ErrorCategory;
		retryable: boolean;
		details?: Record<string, unknown>;
	};
}
