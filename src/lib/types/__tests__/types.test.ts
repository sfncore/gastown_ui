/**
 * Gas Town Types Unit Tests
 *
 * Verifies type/schema alignment, validates sample data, and ensures
 * forward compatibility with passthrough() for evolving CLI output.
 */

import { describe, it, expect } from 'vitest';
import type {
	GtStatus,
	GtAgent,
	GtConvoy,
	BdBead,
	GtMailMessage,
	GtMergeQueueItem,
	GtFormula,
	GtMolecule,
	GtDoctorResult,
	GtRig,
	GtFeedItem,
	GtSnapshot,
	SlingTarget
} from '../gastown';
import {
	GtStatusSchema,
	GtAgentSchema,
	GtConvoySchema,
	BdBeadSchema,
	GtMailMessageSchema,
	GtMergeQueueItemSchema,
	GtFormulaSchema,
	GtMoleculeSchema,
	GtDoctorResultSchema,
	GtRigSchema,
	GtFeedItemSchema,
	GtSnapshotSchema,
	SlingTargetSchema,
	GtAgentSummarySchema,
	GtRigInfoSchema,
	GtOverseerSchema
} from '../gastown.schema';

// =============================================================================
// Sample Data Fixtures
// =============================================================================

const sampleOverseer = {
	name: 'Avyukth',
	email: 'subhrajit.makur@hotmail.com',
	username: 'subhrajit.makur',
	source: 'git-config',
	unread_mail: 0
};

const sampleAgentSummary = {
	name: 'mayor',
	address: 'mayor/',
	session: 'hq-mayor',
	role: 'coordinator',
	running: true,
	has_work: false,
	state: 'idle' as const,
	unread_mail: 0
};

const sampleHookInfo = {
	agent: 'gastown_ui/amp',
	role: 'polecat',
	has_work: false
};

const sampleRigInfo = {
	name: 'gastown_ui',
	polecats: ['amp', 'gastown_ui-56'],
	polecat_count: 2,
	crews: ['jack'],
	crew_count: 1,
	has_witness: true,
	has_refinery: true,
	hooks: [sampleHookInfo],
	agents: [sampleAgentSummary]
};

const sampleStatus: GtStatus = {
	name: 'gastown_exp',
	location: '/Users/test/gastown_exp',
	overseer: sampleOverseer,
	agents: [sampleAgentSummary],
	rigs: [sampleRigInfo]
};

const sampleAgent: GtAgent = {
	name: 'amp',
	id: 'gastown_ui-amp-12345',
	status: 'active',
	session_id: 'gt-gastown_ui-amp',
	rig: 'gastown_ui',
	worktree: '/Users/test/gastown_exp/gastown_ui/polecats/amp/gastown_ui',
	branch: 'polecat/amp/gu-20z',
	last_activity: '2026-01-19T22:51:00Z',
	last_activity_ago: '5m ago',
	current_task: 'gu-20z',
	current_molecule: 'mol-polecat-work',
	health: 'healthy'
};

const sampleConvoy: GtConvoy = {
	id: 'convoy-123',
	title: 'TypeScript Data Models Sprint',
	description: 'Creating comprehensive type definitions',
	status: 'open',
	work_status: 'active',
	progress: '3/10',
	completed: 3,
	total: 10,
	created_at: '2026-01-12T00:00:00Z',
	updated_at: '2026-01-19T22:51:00Z',
	tracked_issues: [
		{
			id: 'gu-20z',
			title: 'Create comprehensive TypeScript data model types',
			status: 'in_progress',
			assignee: 'gastown_ui/polecats/amp',
			priority: 1
		}
	]
};

const sampleBead: BdBead = {
	id: 'gu-20z',
	title: 'Create comprehensive TypeScript data model types',
	description: 'All CLI output types must be defined in TypeScript with Zod schemas',
	status: 'in_progress',
	priority: 1,
	issue_type: 'task',
	assignee: 'gastown_ui/polecats/amp',
	created_at: '2026-01-12T00:00:00Z',
	created_by: 'mayor',
	updated_at: '2026-01-19T22:51:00Z',
	labels: ['typescript', 'types'],
	ephemeral: false,
	parent_id: 'gu-da0'
};

const sampleMail: GtMailMessage = {
	id: 'mail-12345',
	from: 'mayor/',
	to: 'gastown_ui/polecats/amp',
	subject: 'Work Assignment: gu-20z',
	body: 'You have been assigned to work on TypeScript data models.',
	timestamp: '2026-01-19T22:50:00Z',
	read: false,
	priority: 'normal',
	type: 'task',
	delivery: 'queue',
	thread_id: 'thread-abc',
	pinned: false,
	wisp: false
};

const sampleMergeQueueItem: GtMergeQueueItem = {
	id: 'mq-12345',
	branch: 'polecat/amp/gu-20z',
	repo: 'gastown_ui',
	polecat: 'amp',
	rig: 'gastown_ui',
	status: 'pending',
	priority: 1,
	submitted_at: '2026-01-19T22:51:00Z',
	ci_status: 'pending',
	mergeable: 'pending'
};

const sampleFormula: GtFormula = {
	name: 'mol-polecat-work',
	description: 'Standard polecat work molecule',
	category: 'work',
	steps: [
		{
			id: 'step-1',
			name: 'check-hook',
			description: 'Check hook for assigned work',
			required: true
		},
		{
			id: 'step-2',
			name: 'execute-task',
			required: true
		}
	],
	parameters: {
		timeout: {
			type: 'number',
			required: false,
			default: 3600,
			description: 'Timeout in seconds'
		}
	}
};

const sampleMolecule: GtMolecule = {
	id: 'mol-12345',
	formula: 'mol-polecat-work',
	status: 'running',
	current_step: 'execute-task',
	steps: [
		{
			id: 'step-1',
			name: 'check-hook',
			status: 'completed',
			started_at: '2026-01-19T22:50:00Z',
			completed_at: '2026-01-19T22:50:30Z'
		},
		{
			id: 'step-2',
			name: 'execute-task',
			status: 'running',
			started_at: '2026-01-19T22:50:30Z'
		}
	],
	started_at: '2026-01-19T22:50:00Z',
	agent: 'gastown_ui/polecats/amp'
};

const sampleDoctorResult: GtDoctorResult = {
	overall: 'healthy',
	checks: [
		{
			name: 'daemon-running',
			category: 'core',
			status: 'pass',
			message: 'Daemon is running'
		},
		{
			name: 'git-version',
			category: 'dependencies',
			status: 'pass',
			message: 'Git version 2.40.0',
			details: 'Minimum required: 2.30.0'
		}
	],
	summary: {
		passed: 2,
		warned: 0,
		failed: 0,
		total: 2
	}
};

const sampleRig: GtRig = {
	name: 'gastown_ui',
	path: '/Users/test/gastown_exp/gastown_ui',
	worktree_root: '/Users/test/gastown_exp/gastown_ui/polecats',
	branch: 'main',
	remote: 'origin',
	agents: [
		{
			name: 'amp',
			role: 'polecat',
			status: 'active'
		}
	],
	config: {
		main_branch: 'main',
		work_branch_prefix: 'polecat/',
		auto_merge: true,
		require_review: false
	},
	docked: true,
	status: 'active'
};

const sampleFeedItem: GtFeedItem = {
	id: 'feed-12345',
	type: 'agent_status',
	timestamp: '2026-01-19T22:51:00Z',
	title: 'Agent amp started work',
	description: 'Working on gu-20z: Create comprehensive TypeScript data model types',
	agent: 'gastown_ui/polecats/amp',
	rig: 'gastown_ui',
	severity: 'info'
};

const sampleSlingTarget: SlingTarget = {
	rig: 'gastown_ui',
	agent: 'amp',
	status: 'idle',
	display: 'gastown_ui/amp (idle)'
};

const sampleSnapshot: GtSnapshot = {
	status: sampleStatus,
	mailCount: 5,
	queueCount: 2,
	recentActivity: [sampleFeedItem],
	freshness: {
		fetchedAt: '2026-01-19T22:51:00Z',
		ttlMs: 10000
	}
};

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Gas Town Types - Schema Validation', () => {
	describe('Status Types', () => {
		it('validates GtOverseer schema', () => {
			const result = GtOverseerSchema.safeParse(sampleOverseer);
			expect(result.success).toBe(true);
		});

		it('validates GtAgentSummary schema', () => {
			const result = GtAgentSummarySchema.safeParse(sampleAgentSummary);
			expect(result.success).toBe(true);
		});

		it('validates GtRigInfo schema', () => {
			const result = GtRigInfoSchema.safeParse(sampleRigInfo);
			expect(result.success).toBe(true);
		});

		it('validates GtStatus schema', () => {
			const result = GtStatusSchema.safeParse(sampleStatus);
			expect(result.success).toBe(true);
		});

		it('validates GtAgent schema', () => {
			const result = GtAgentSchema.safeParse(sampleAgent);
			expect(result.success).toBe(true);
		});
	});

	describe('Convoy Types', () => {
		it('validates GtConvoy schema', () => {
			const result = GtConvoySchema.safeParse(sampleConvoy);
			expect(result.success).toBe(true);
		});
	});

	describe('Bead Types', () => {
		it('validates BdBead schema', () => {
			const result = BdBeadSchema.safeParse(sampleBead);
			expect(result.success).toBe(true);
		});
	});

	describe('Mail Types', () => {
		it('validates GtMailMessage schema', () => {
			const result = GtMailMessageSchema.safeParse(sampleMail);
			expect(result.success).toBe(true);
		});
	});

	describe('Queue Types', () => {
		it('validates GtMergeQueueItem schema', () => {
			const result = GtMergeQueueItemSchema.safeParse(sampleMergeQueueItem);
			expect(result.success).toBe(true);
		});
	});

	describe('Workflow Types', () => {
		it('validates GtFormula schema', () => {
			const result = GtFormulaSchema.safeParse(sampleFormula);
			expect(result.success).toBe(true);
		});

		it('validates GtMolecule schema', () => {
			const result = GtMoleculeSchema.safeParse(sampleMolecule);
			expect(result.success).toBe(true);
		});
	});

	describe('Health Types', () => {
		it('validates GtDoctorResult schema', () => {
			const result = GtDoctorResultSchema.safeParse(sampleDoctorResult);
			expect(result.success).toBe(true);
		});
	});

	describe('Rig Types', () => {
		it('validates GtRig schema', () => {
			const result = GtRigSchema.safeParse(sampleRig);
			expect(result.success).toBe(true);
		});
	});

	describe('Feed Types', () => {
		it('validates GtFeedItem schema', () => {
			const result = GtFeedItemSchema.safeParse(sampleFeedItem);
			expect(result.success).toBe(true);
		});
	});

	describe('Sling Types', () => {
		it('validates SlingTarget schema', () => {
			const result = SlingTargetSchema.safeParse(sampleSlingTarget);
			expect(result.success).toBe(true);
		});
	});

	describe('Snapshot Types', () => {
		it('validates GtSnapshot schema', () => {
			const result = GtSnapshotSchema.safeParse(sampleSnapshot);
			expect(result.success).toBe(true);
		});
	});
});

// =============================================================================
// Forward Compatibility Tests
// =============================================================================

describe('Gas Town Types - Forward Compatibility', () => {
	it('allows extra fields with passthrough() on GtStatus', () => {
		const extendedStatus = {
			...sampleStatus,
			new_field: 'future feature',
			another_field: { nested: true }
		};
		const result = GtStatusSchema.safeParse(extendedStatus);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveProperty('new_field', 'future feature');
			expect(result.data).toHaveProperty('another_field');
		}
	});

	it('allows extra fields with passthrough() on GtAgent', () => {
		const extendedAgent = {
			...sampleAgent,
			performance_metrics: { cpu: 50, memory: 1024 }
		};
		const result = GtAgentSchema.safeParse(extendedAgent);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveProperty('performance_metrics');
		}
	});

	it('allows extra fields with passthrough() on BdBead', () => {
		const extendedBead = {
			...sampleBead,
			custom_metadata: { team: 'platform' }
		};
		const result = BdBeadSchema.safeParse(extendedBead);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveProperty('custom_metadata');
		}
	});

	it('allows extra fields with passthrough() on GtMolecule', () => {
		const extendedMolecule = {
			...sampleMolecule,
			metrics: { duration_ms: 5000 }
		};
		const result = GtMoleculeSchema.safeParse(extendedMolecule);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveProperty('metrics');
		}
	});
});

// =============================================================================
// Type/Schema Alignment Tests
// =============================================================================

describe('Gas Town Types - Type/Schema Alignment', () => {
	it('GtStatus type matches schema output', () => {
		const parsed = GtStatusSchema.parse(sampleStatus);
		// TypeScript compilation ensures type alignment
		const typed: GtStatus = {
			name: parsed.name,
			location: parsed.location,
			overseer: parsed.overseer,
			agents: parsed.agents,
			rigs: parsed.rigs
		};
		expect(typed.name).toBe('gastown_exp');
	});

	it('GtAgent type matches schema output', () => {
		const parsed = GtAgentSchema.parse(sampleAgent);
		const typed: GtAgent = {
			name: parsed.name,
			id: parsed.id,
			status: parsed.status,
			session_id: parsed.session_id,
			rig: parsed.rig,
			worktree: parsed.worktree,
			branch: parsed.branch,
			last_activity: parsed.last_activity,
			last_activity_ago: parsed.last_activity_ago,
			current_task: parsed.current_task,
			current_molecule: parsed.current_molecule,
			health: parsed.health
		};
		expect(typed.status).toBe('active');
	});

	it('BdBead type matches schema output', () => {
		const parsed = BdBeadSchema.parse(sampleBead);
		const typed: BdBead = {
			id: parsed.id,
			title: parsed.title,
			description: parsed.description,
			status: parsed.status,
			priority: parsed.priority,
			issue_type: parsed.issue_type,
			assignee: parsed.assignee,
			created_at: parsed.created_at,
			created_by: parsed.created_by,
			updated_at: parsed.updated_at,
			labels: parsed.labels,
			ephemeral: parsed.ephemeral,
			parent_id: parsed.parent_id
		};
		expect(typed.status).toBe('in_progress');
	});
});

// =============================================================================
// Validation Error Tests
// =============================================================================

describe('Gas Town Types - Validation Errors', () => {
	it('rejects invalid agent status', () => {
		const invalidAgent = {
			...sampleAgent,
			status: 'invalid_status'
		};
		const result = GtAgentSchema.safeParse(invalidAgent);
		expect(result.success).toBe(false);
	});

	it('rejects missing required fields on GtStatus', () => {
		const incompleteStatus = {
			name: 'test'
			// Missing location, overseer, agents, rigs
		};
		const result = GtStatusSchema.safeParse(incompleteStatus);
		expect(result.success).toBe(false);
	});

	it('rejects invalid mail priority', () => {
		const invalidMail = {
			...sampleMail,
			priority: 'super_urgent' // Not a valid priority
		};
		const result = GtMailMessageSchema.safeParse(invalidMail);
		expect(result.success).toBe(false);
	});

	it('rejects invalid molecule status', () => {
		const invalidMolecule = {
			...sampleMolecule,
			status: 'cooking' // Not a valid status
		};
		const result = GtMoleculeSchema.safeParse(invalidMolecule);
		expect(result.success).toBe(false);
	});

	it('rejects invalid health check status', () => {
		const invalidDoctor = {
			...sampleDoctorResult,
			overall: 'excellent' // Not a valid overall status
		};
		const result = GtDoctorResultSchema.safeParse(invalidDoctor);
		expect(result.success).toBe(false);
	});
});

// =============================================================================
// Optional Field Tests
// =============================================================================

describe('Gas Town Types - Optional Fields', () => {
	it('accepts GtAgent without optional fields', () => {
		const minimalAgent: GtAgent = {
			name: 'test',
			id: 'test-id',
			status: 'idle',
			session_id: 'session-123',
			rig: 'test-rig',
			worktree: '/path/to/worktree',
			last_activity: '2026-01-19T00:00:00Z',
			last_activity_ago: '1h ago',
			health: 'healthy'
			// branch, current_task, current_molecule are optional
		};
		const result = GtAgentSchema.safeParse(minimalAgent);
		expect(result.success).toBe(true);
	});

	it('accepts GtConvoy without description', () => {
		const convoyWithoutDesc = {
			...sampleConvoy,
			description: undefined
		};
		delete (convoyWithoutDesc as Record<string, unknown>).description;
		const result = GtConvoySchema.safeParse(convoyWithoutDesc);
		expect(result.success).toBe(true);
	});

	it('accepts GtMergeQueueItem without CI status', () => {
		const queueItemNoCi = {
			...sampleMergeQueueItem,
			ci_status: undefined,
			mergeable: undefined
		};
		delete (queueItemNoCi as Record<string, unknown>).ci_status;
		delete (queueItemNoCi as Record<string, unknown>).mergeable;
		const result = GtMergeQueueItemSchema.safeParse(queueItemNoCi);
		expect(result.success).toBe(true);
	});

	it('accepts GtFormula without parameters', () => {
		const formulaNoParams = {
			...sampleFormula,
			parameters: undefined
		};
		delete (formulaNoParams as Record<string, unknown>).parameters;
		const result = GtFormulaSchema.safeParse(formulaNoParams);
		expect(result.success).toBe(true);
	});
});
