import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	// In production, this would call bd show <id> --json
	const issue = mockIssues[id];

	if (!issue) {
		// Return a generic mock for unknown IDs
		const genericIssue: IssueDetail = {
			id,
			title: `Issue ${id}`,
			description: 'Issue details would be loaded from beads system.',
			status: 'open',
			priority: 2,
			issue_type: 'task',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			activity: [
				{
					id: 'act-1',
					timestamp: new Date().toISOString(),
					type: 'created',
					actor: 'system',
					details: { message: 'Issue created' }
				}
			],
			related_issues: [],
			blocked_by: [],
			blocking: []
		};
		return { issue: genericIssue };
	}

	return { issue };
};
