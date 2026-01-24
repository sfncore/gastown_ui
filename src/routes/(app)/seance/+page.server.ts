import type { PageServerLoad } from './$types';

export interface SessionMessage {
	id: string;
	role: 'user' | 'assistant' | 'tool';
	content: string;
	timestamp: string;
	toolName?: string;
	toolResult?: string;
}

export interface Session {
	id: string;
	agentName: string;
	agentType: 'polecat' | 'witness' | 'refinery' | 'mayor';
	rig: string;
	status: 'active' | 'completed' | 'crashed';
	startTime: string;
	endTime: string | null;
	duration: number; // minutes
	messageCount: number;
	toolCallCount: number;
	filesModified: string[];
	errors: string[];
	transcript: SessionMessage[];
}

// Generate mock sessions with realistic data
function generateMockSessions(): Session[] {
	const now = new Date();
	const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
	const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

	return [
		{
			id: 'sess-a1b2c3',
			agentName: 'furiosa',
			agentType: 'polecat',
			rig: 'gastown_ui',
			status: 'active',
			startTime: hourAgo.toISOString(),
			endTime: null,
			duration: 58,
			messageCount: 47,
			toolCallCount: 23,
			filesModified: [
				'src/routes/seance/+page.svelte',
				'src/routes/seance/+page.server.ts'
			],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Create the seance page for viewing session history',
					timestamp: hourAgo.toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'I\'ll create the seance page with session list, filters, and detail view. Let me start by examining the existing patterns.',
					timestamp: new Date(hourAgo.getTime() + 5000).toISOString()
				},
				{
					id: 'msg-3',
					role: 'tool',
					content: 'Glob: src/routes/**/*.svelte',
					timestamp: new Date(hourAgo.getTime() + 10000).toISOString(),
					toolName: 'Glob',
					toolResult: 'Found 15 files'
				},
				{
					id: 'msg-4',
					role: 'assistant',
					content: 'Found the activity and logs pages. I\'ll use their patterns for the seance page.',
					timestamp: new Date(hourAgo.getTime() + 15000).toISOString()
				}
			]
		},
		{
			id: 'sess-d4e5f6',
			agentName: 'rictus',
			agentType: 'polecat',
			rig: 'gastown_ui',
			status: 'completed',
			startTime: twoHoursAgo.toISOString(),
			endTime: new Date(twoHoursAgo.getTime() + 45 * 60 * 1000).toISOString(),
			duration: 45,
			messageCount: 32,
			toolCallCount: 18,
			filesModified: [
				'src/lib/components/StatusIndicator.svelte',
				'src/lib/components/index.ts'
			],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Add new status variants to the StatusIndicator component',
					timestamp: twoHoursAgo.toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'I\'ll add the new status variants. Let me read the current component first.',
					timestamp: new Date(twoHoursAgo.getTime() + 3000).toISOString()
				},
				{
					id: 'msg-3',
					role: 'tool',
					content: 'Read: src/lib/components/StatusIndicator.svelte',
					timestamp: new Date(twoHoursAgo.getTime() + 5000).toISOString(),
					toolName: 'Read',
					toolResult: 'File contents loaded'
				},
				{
					id: 'msg-4',
					role: 'assistant',
					content: 'Added \'crashed\' and \'paused\' status variants with appropriate styling.',
					timestamp: new Date(twoHoursAgo.getTime() + 30 * 60 * 1000).toISOString()
				}
			]
		},
		{
			id: 'sess-g7h8i9',
			agentName: 'witness',
			agentType: 'witness',
			rig: 'gastown_ui',
			status: 'completed',
			startTime: yesterday.toISOString(),
			endTime: new Date(yesterday.getTime() + 15 * 60 * 1000).toISOString(),
			duration: 15,
			messageCount: 12,
			toolCallCount: 8,
			filesModified: [],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Check polecat health and process any nudges',
					timestamp: yesterday.toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'Running health check on all active polecats.',
					timestamp: new Date(yesterday.getTime() + 2000).toISOString()
				},
				{
					id: 'msg-3',
					role: 'tool',
					content: 'Bash: gt polecat list',
					timestamp: new Date(yesterday.getTime() + 5000).toISOString(),
					toolName: 'Bash',
					toolResult: 'furiosa: active, rictus: idle'
				}
			]
		},
		{
			id: 'sess-j1k2l3',
			agentName: 'slit',
			agentType: 'polecat',
			rig: 'gastown_ui',
			status: 'crashed',
			startTime: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
			duration: 12,
			messageCount: 8,
			toolCallCount: 5,
			filesModified: ['src/routes/queue/+page.svelte'],
			errors: [
				'SIGKILL: Process terminated unexpectedly',
				'Context window exceeded: 198k/200k tokens'
			],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Refactor the queue page to use the new layout component',
					timestamp: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000).toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'I\'ll refactor the queue page. Let me examine the current implementation.',
					timestamp: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000 + 3000).toISOString()
				},
				{
					id: 'msg-3',
					role: 'tool',
					content: 'Read: src/routes/queue/+page.svelte',
					timestamp: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000 + 6000).toISOString(),
					toolName: 'Read',
					toolResult: 'File contents loaded'
				},
				{
					id: 'msg-4',
					role: 'assistant',
					content: '[Session crashed - context limit exceeded]',
					timestamp: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString()
				}
			]
		},
		{
			id: 'sess-m4n5o6',
			agentName: 'refinery',
			agentType: 'refinery',
			rig: 'gastown_ui',
			status: 'completed',
			startTime: twoDaysAgo.toISOString(),
			endTime: new Date(twoDaysAgo.getTime() + 8 * 60 * 1000).toISOString(),
			duration: 8,
			messageCount: 6,
			toolCallCount: 12,
			filesModified: [],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Process merge queue',
					timestamp: twoDaysAgo.toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'Checking merge queue for pending branches.',
					timestamp: new Date(twoDaysAgo.getTime() + 2000).toISOString()
				},
				{
					id: 'msg-3',
					role: 'tool',
					content: 'Bash: gt mq list gastown_ui',
					timestamp: new Date(twoDaysAgo.getTime() + 5000).toISOString(),
					toolName: 'Bash',
					toolResult: '2 branches pending'
				},
				{
					id: 'msg-4',
					role: 'assistant',
					content: 'Merged 2 branches to main. All tests passed.',
					timestamp: new Date(twoDaysAgo.getTime() + 8 * 60 * 1000).toISOString()
				}
			]
		},
		{
			id: 'sess-p7q8r9',
			agentName: 'nux',
			agentType: 'polecat',
			rig: 'gastown_api',
			status: 'completed',
			startTime: new Date(twoDaysAgo.getTime() + 6 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(twoDaysAgo.getTime() + 6 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
			duration: 90,
			messageCount: 78,
			toolCallCount: 45,
			filesModified: [
				'src/handlers/auth.rs',
				'src/middleware/jwt.rs',
				'src/routes/mod.rs'
			],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Implement JWT refresh token endpoint',
					timestamp: new Date(twoDaysAgo.getTime() + 6 * 60 * 60 * 1000).toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'I\'ll implement the JWT refresh token endpoint. Let me start by understanding the current auth structure.',
					timestamp: new Date(twoDaysAgo.getTime() + 6 * 60 * 60 * 1000 + 4000).toISOString()
				}
			]
		},
		{
			id: 'sess-s1t2u3',
			agentName: 'capable',
			agentType: 'polecat',
			rig: 'gastown_ui',
			status: 'completed',
			startTime: new Date(twoDaysAgo.getTime() + 10 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(twoDaysAgo.getTime() + 10 * 60 * 60 * 1000 + 35 * 60 * 1000).toISOString(),
			duration: 35,
			messageCount: 24,
			toolCallCount: 15,
			filesModified: [
				'src/app.css',
				'tailwind.config.ts'
			],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Add dark mode support to the UI',
					timestamp: new Date(twoDaysAgo.getTime() + 10 * 60 * 60 * 1000).toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'I\'ll add dark mode support. Let me check the current theme configuration.',
					timestamp: new Date(twoDaysAgo.getTime() + 10 * 60 * 60 * 1000 + 3000).toISOString()
				}
			]
		},
		{
			id: 'sess-v4w5x6',
			agentName: 'mayor',
			agentType: 'mayor',
			rig: 'town',
			status: 'completed',
			startTime: new Date(twoDaysAgo.getTime() + 12 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(twoDaysAgo.getTime() + 12 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
			duration: 20,
			messageCount: 15,
			toolCallCount: 10,
			filesModified: [],
			errors: [],
			transcript: [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Coordinate work distribution across rigs',
					timestamp: new Date(twoDaysAgo.getTime() + 12 * 60 * 60 * 1000).toISOString()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'Checking convoy status and dispatching work to available polecats.',
					timestamp: new Date(twoDaysAgo.getTime() + 12 * 60 * 60 * 1000 + 2000).toISOString()
				}
			]
		}
	];
}

export const load: PageServerLoad = async ({ url }) => {
	const agentFilter = url.searchParams.get('agent') || '';
	const rigFilter = url.searchParams.get('rig') || '';
	const statusFilter = url.searchParams.get('status') || '';
	const searchQuery = url.searchParams.get('q') || '';
	const dateFrom = url.searchParams.get('from') || '';
	const dateTo = url.searchParams.get('to') || '';

	try {
		const allSessions = generateMockSessions();

		// Extract unique values for filters
		const agents = [...new Set(allSessions.map((s) => s.agentName))].sort();
		const rigs = [...new Set(allSessions.map((s) => s.rig))].sort();
		const statuses: Session['status'][] = ['active', 'completed', 'crashed'];

		// Apply filters
		let filtered = allSessions;

		if (agentFilter) {
			filtered = filtered.filter((s) => s.agentName === agentFilter);
		}

		if (rigFilter) {
			filtered = filtered.filter((s) => s.rig === rigFilter);
		}

		if (statusFilter) {
			filtered = filtered.filter((s) => s.status === statusFilter);
		}

		if (dateFrom) {
			const fromDate = new Date(dateFrom);
			filtered = filtered.filter((s) => new Date(s.startTime) >= fromDate);
		}

		if (dateTo) {
			const toDate = new Date(dateTo);
			toDate.setHours(23, 59, 59, 999);
			filtered = filtered.filter((s) => new Date(s.startTime) <= toDate);
		}

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((s) => {
				// Search in session metadata
				if (s.agentName.toLowerCase().includes(query)) return true;
				if (s.rig.toLowerCase().includes(query)) return true;
				if (s.id.toLowerCase().includes(query)) return true;

				// Search in transcript
				return s.transcript.some((msg) => msg.content.toLowerCase().includes(query));
			});
		}

		// Sort by start time, newest first
		filtered.sort(
			(a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
		);

		return {
			sessions: filtered,
			agents,
			rigs,
			statuses,
			error: null,
			filters: {
				agent: agentFilter,
				rig: rigFilter,
				status: statusFilter,
				search: searchQuery,
				dateFrom,
				dateTo
			}
		};
	} catch (err) {
		const errorMessage =
			err instanceof Error ? err.message : 'Unknown error loading sessions';
		return {
			sessions: [],
			agents: [],
			rigs: [],
			statuses: [],
			error: errorMessage,
			filters: {
				agent: agentFilter,
				rig: rigFilter,
				status: statusFilter,
				search: searchQuery,
				dateFrom,
				dateTo
			}
		};
	}
};
