import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// GT_ROOT for accessing beads from the orchestrator level
const GT_ROOT = '/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp';

export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'completed';
export type IssueType = 'task' | 'bug' | 'feature' | 'epic';
export type Priority = 0 | 1 | 2 | 3 | 4;

export interface ActivityEvent {
	id: string;
	timestamp: string;
	type: 'status_change' | 'assignment' | 'comment' | 'created' | 'convoy_added';
	actor: string;
	details: {
		from?: string;
		to?: string;
		message?: string;
		convoy_id?: string;
	};
}

export interface RelatedIssue {
	id: string;
	title: string;
	status: IssueStatus;
}

export interface IssueDetail {
	id: string;
	title: string;
	description?: string;
	status: IssueStatus;
	priority: Priority;
	issue_type: IssueType;
	created_at: string;
	updated_at: string;
	assignee?: string;
	convoy_id?: string;
	convoy_title?: string;
	activity: ActivityEvent[];
	related_issues: RelatedIssue[];
	blocked_by: string[];
	blocking: string[];
}

// Interface for bd show JSON output
interface BdShowIssue {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority: number;
	issue_type: string;
	owner?: string;
	created_at: string;
	created_by?: string;
	updated_at: string;
	assignee?: string;
	convoy_id?: string;
	blocked_by?: string[];
	blocking?: string[];
}

// Mock data for development
const mockIssues: Record<string, IssueDetail> = {
	'gt-d3a': {
		id: 'gt-d3a',
		title: 'Authentication',
		description: 'Implement user authentication system with JWT tokens and session management.',
		status: 'in_progress',
		priority: 1,
		issue_type: 'epic',
		created_at: '2026-01-02T10:30:00Z',
		updated_at: '2026-01-06T02:45:00Z',
		assignee: 'gastown_ui/polecats/rictus',
		convoy_id: 'convoy-auth-001',
		convoy_title: 'Authentication Sprint',
		activity: [
			{
				id: 'act-1',
				timestamp: '2026-01-06T02:45:00Z',
				type: 'status_change',
				actor: 'gastown_ui/polecats/rictus',
				details: { from: 'open', to: 'in_progress' }
			},
			{
				id: 'act-2',
				timestamp: '2026-01-05T14:20:00Z',
				type: 'assignment',
				actor: 'gastown_ui/witness',
				details: { to: 'gastown_ui/polecats/rictus' }
			},
			{
				id: 'act-3',
				timestamp: '2026-01-04T09:00:00Z',
				type: 'convoy_added',
				actor: 'mayor',
				details: { convoy_id: 'convoy-auth-001' }
			},
			{
				id: 'act-4',
				timestamp: '2026-01-02T10:30:00Z',
				type: 'created',
				actor: 'mayor',
				details: { message: 'Epic created for authentication work' }
			}
		],
		related_issues: [
			{ id: 'gt-be4', title: 'Auth Token Refresh', status: 'open' },
			{ id: 'gt-931', title: 'CSRF Protection', status: 'open' }
		],
		blocked_by: [],
		blocking: ['gt-be4', 'gt-931']
	},
	'gt-be4': {
		id: 'gt-be4',
		title: 'Auth Token Refresh',
		description: 'Implement automatic token refresh mechanism before expiry.',
		status: 'open',
		priority: 2,
		issue_type: 'task',
		created_at: '2026-01-03T11:00:00Z',
		updated_at: '2026-01-03T11:00:00Z',
		convoy_id: 'convoy-auth-001',
		convoy_title: 'Authentication Sprint',
		activity: [
			{
				id: 'act-1',
				timestamp: '2026-01-03T11:00:00Z',
				type: 'created',
				actor: 'mayor',
				details: { message: 'Task created from auth epic breakdown' }
			}
		],
		related_issues: [
			{ id: 'gt-d3a', title: 'Authentication', status: 'in_progress' }
		],
		blocked_by: ['gt-d3a'],
		blocking: []
	},
	'gt-931': {
		id: 'gt-931',
		title: 'CSRF Protection',
		description: 'Add CSRF token validation to all state-changing endpoints.',
		status: 'blocked',
		priority: 2,
		issue_type: 'task',
		created_at: '2026-01-03T11:15:00Z',
		updated_at: '2026-01-05T16:00:00Z',
		convoy_id: 'convoy-auth-001',
		convoy_title: 'Authentication Sprint',
		activity: [
			{
				id: 'act-1',
				timestamp: '2026-01-05T16:00:00Z',
				type: 'status_change',
				actor: 'system',
				details: { from: 'open', to: 'blocked', message: 'Blocked by gt-d3a' }
			},
			{
				id: 'act-2',
				timestamp: '2026-01-03T11:15:00Z',
				type: 'created',
				actor: 'mayor',
				details: { message: 'Task created for CSRF implementation' }
			}
		],
		related_issues: [
			{ id: 'gt-d3a', title: 'Authentication', status: 'in_progress' }
		],
		blocked_by: ['gt-d3a'],
		blocking: []
	},
	'gt-3v5': {
		id: 'gt-3v5',
		title: 'Command Palette',
		description: 'Implement keyboard-driven command palette (Cmd+K) for quick navigation.',
		status: 'completed',
		priority: 2,
		issue_type: 'feature',
		created_at: '2026-01-01T09:00:00Z',
		updated_at: '2026-01-04T17:30:00Z',
		assignee: 'gastown_ui/polecats/furiosa',
		activity: [
			{
				id: 'act-1',
				timestamp: '2026-01-04T17:30:00Z',
				type: 'status_change',
				actor: 'gastown_ui/polecats/furiosa',
				details: { from: 'in_progress', to: 'completed' }
			},
			{
				id: 'act-2',
				timestamp: '2026-01-02T10:00:00Z',
				type: 'status_change',
				actor: 'gastown_ui/polecats/furiosa',
				details: { from: 'open', to: 'in_progress' }
			},
			{
				id: 'act-3',
				timestamp: '2026-01-01T09:00:00Z',
				type: 'created',
				actor: 'mayor',
				details: { message: 'Feature request for command palette' }
			}
		],
		related_issues: [],
		blocked_by: [],
		blocking: []
	}
};

/**
 * Transform bd show output to IssueDetail format
 */
function transformBdIssue(bdIssue: BdShowIssue): IssueDetail {
	// Create activity from created_at and updated_at
	const activity: ActivityEvent[] = [
		{
			id: 'act-created',
			timestamp: bdIssue.created_at,
			type: 'created',
			actor: bdIssue.created_by || 'system',
			details: { message: 'Issue created' }
		}
	];

	// If updated_at differs from created_at, add an update event
	if (bdIssue.updated_at !== bdIssue.created_at) {
		activity.push({
			id: 'act-updated',
			timestamp: bdIssue.updated_at,
			type: 'status_change',
			actor: bdIssue.assignee || bdIssue.owner || 'system',
			details: { to: bdIssue.status }
		});
	}

	return {
		id: bdIssue.id,
		title: bdIssue.title,
		description: bdIssue.description,
		status: bdIssue.status as IssueStatus,
		priority: bdIssue.priority as Priority,
		issue_type: bdIssue.issue_type as IssueType,
		created_at: bdIssue.created_at,
		updated_at: bdIssue.updated_at,
		assignee: bdIssue.assignee || bdIssue.owner,
		convoy_id: bdIssue.convoy_id,
		activity: activity.reverse(), // Newest first
		related_issues: [], // TODO: Could be fetched from dependencies
		blocked_by: bdIssue.blocked_by || [],
		blocking: bdIssue.blocking || []
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	try {
		const { stdout } = await execAsync(`bd show ${id} --json`, {
			cwd: GT_ROOT,
			timeout: 5000
		});

		const issues: BdShowIssue[] = JSON.parse(stdout);

		if (!issues || issues.length === 0) {
			throw error(404, `Issue "${id}" not found`);
		}

		const issue = transformBdIssue(issues[0]);
		return { issue };
	} catch (err) {
		// Check if it's a 404 error
		if (err instanceof Error && 'status' in err) {
			throw err; // Re-throw HTTP errors
		}

		// Check for bd command errors
		if (err instanceof Error && err.message.includes('no issue found')) {
			throw error(404, `Issue "${id}" not found`);
		}

		// Fallback to mock data on error (for development)
		console.error(`Failed to fetch issue ${id}:`, err);
		const issue = mockIssues[id];

		if (issue) {
			return { issue };
		}

		throw error(500, 'Failed to load issue details');
	}
};
