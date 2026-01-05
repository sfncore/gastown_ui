/**
 * Work API Fixtures
 *
 * Mock data for issues, convoys, and work management
 */

/** Issue priority */
export type IssuePriority = 0 | 1 | 2 | 3 | 4;

/** Issue status */
export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed';

/** Issue type */
export type IssueType = 'task' | 'bug' | 'feature' | 'epic';

/** Issue fixture */
export interface MockIssue {
	id: string;
	title: string;
	description: string;
	status: IssueStatus;
	priority: IssuePriority;
	type: IssueType;
	assignee?: string;
	created_at: string;
	updated_at: string;
	parent_id?: string;
	depends_on?: string[];
	blocks?: string[];
}

/** Convoy fixture */
export interface MockConvoy {
	id: string;
	name: string;
	status: 'active' | 'completed' | 'stalled';
	issues: string[];
	progress: number;
	created_at: string;
}

/** Mock issues */
export const mockIssues: MockIssue[] = [
	{
		id: 'gt-d3a',
		title: 'Authentication',
		description: 'Login page, auth token refresh, CSRF protection. Required for production.',
		status: 'open',
		priority: 1,
		type: 'epic',
		created_at: '2026-01-05T21:41:00Z',
		updated_at: '2026-01-05T21:49:00Z'
	},
	{
		id: 'gt-931',
		title: 'CSRF Protection',
		description: 'CSRF token generation and validation on mutations.',
		status: 'in_progress',
		priority: 2,
		type: 'task',
		assignee: 'furiosa',
		parent_id: 'gt-d3a',
		depends_on: ['gt-d3a'],
		created_at: '2026-01-05T21:41:00Z',
		updated_at: '2026-01-06T03:44:00Z'
	},
	{
		id: 'gt-be4',
		title: 'Auth Token Refresh',
		description: 'Automatic token refresh before expiration.',
		status: 'in_progress',
		priority: 2,
		type: 'task',
		assignee: 'nux',
		parent_id: 'gt-d3a',
		depends_on: ['gt-d3a'],
		created_at: '2026-01-05T21:41:00Z',
		updated_at: '2026-01-06T02:30:00Z'
	},
	{
		id: 'gt-2hs',
		title: 'UI Components',
		description: 'Command Palette, Connection Lost, Input, Button, StatusBadge, StatsCard components.',
		status: 'open',
		priority: 2,
		type: 'epic',
		created_at: '2026-01-05T21:41:00Z',
		updated_at: '2026-01-05T21:49:00Z'
	},
	{
		id: 'gt-3v5',
		title: 'Command Palette',
		description: 'Global Cmd+K command palette with fuzzy search.',
		status: 'open',
		priority: 2,
		type: 'task',
		parent_id: 'gt-2hs',
		depends_on: ['gt-2hs'],
		created_at: '2026-01-05T21:42:00Z',
		updated_at: '2026-01-05T21:49:00Z'
	},
	{
		id: 'gt-6wn',
		title: 'Input Component',
		description: 'Industrial style: icon prefix, corner accent decorations, password visibility toggle.',
		status: 'open',
		priority: 2,
		type: 'task',
		parent_id: 'gt-2hs',
		depends_on: ['gt-2hs'],
		created_at: '2026-01-05T21:42:00Z',
		updated_at: '2026-01-06T01:34:00Z'
	},
	{
		id: 'gt-1de',
		title: 'Button Component',
		description: 'Variants: Primary, Secondary, Danger, Ghost. Icon button support, full width option.',
		status: 'open',
		priority: 2,
		type: 'task',
		parent_id: 'gt-2hs',
		depends_on: ['gt-2hs'],
		created_at: '2026-01-05T21:42:00Z',
		updated_at: '2026-01-06T02:51:00Z'
	},
	{
		id: 'gt-087',
		title: 'Mobile Refinements',
		description: 'Mobile login, tab views, rich agent cards.',
		status: 'open',
		priority: 2,
		type: 'epic',
		created_at: '2026-01-05T21:41:00Z',
		updated_at: '2026-01-05T21:49:00Z'
	},
	{
		id: 'gt-asc',
		title: 'Mobile Agent Cards Rich',
		description: 'Image hero section, task/uptime metadata, Inspect/Reboot buttons, error state styling.',
		status: 'in_progress',
		priority: 2,
		type: 'task',
		assignee: 'furiosa',
		parent_id: 'gt-087',
		depends_on: ['gt-087'],
		created_at: '2026-01-05T21:42:00Z',
		updated_at: '2026-01-06T03:50:00Z'
	}
];

/** Mock convoys */
export const mockConvoys: MockConvoy[] = [
	{
		id: 'convoy-001',
		name: 'Sprint 1: Core Auth',
		status: 'active',
		issues: ['gt-d3a', 'gt-931', 'gt-be4'],
		progress: 33,
		created_at: '2026-01-05T21:45:00Z'
	},
	{
		id: 'convoy-002',
		name: 'Sprint 1: UI Components',
		status: 'active',
		issues: ['gt-2hs', 'gt-3v5', 'gt-6wn', 'gt-1de'],
		progress: 0,
		created_at: '2026-01-05T21:46:00Z'
	},
	{
		id: 'convoy-003',
		name: 'Sprint 1: Mobile',
		status: 'active',
		issues: ['gt-087', 'gt-asc'],
		progress: 50,
		created_at: '2026-01-05T21:47:00Z'
	}
];

/** Empty issue list */
export const mockEmptyIssues: MockIssue[] = [];

/** Empty convoy list */
export const mockEmptyConvoys: MockConvoy[] = [];

/** Get issue by ID helper */
export function getIssueById(id: string): MockIssue | undefined {
	return mockIssues.find((issue) => issue.id === id);
}

/** Get convoy by ID helper */
export function getConvoyById(id: string): MockConvoy | undefined {
	return mockConvoys.find((convoy) => convoy.id === id);
}

/** Sling work response */
export const mockSlingResponse = {
	success: true,
	message: 'Work slung to gastown_ui/polecats/furiosa'
};

/** Sling work error response */
export const mockSlingErrorResponse = {
	error: 'No available polecats in rig'
};
