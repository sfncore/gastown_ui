/**
 * Integration Tests: /api/gastown/mail
 *
 * Tests the mail endpoint with mocked CLI (Process Supervisor).
 * Verifies message parsing, type detection, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CLIResult } from '$lib/server/cli/contracts';

// Mock the process supervisor module
const mockGt = vi.fn();
const mockBd = vi.fn();

vi.mock('$lib/server/cli', () => ({
	getProcessSupervisor: vi.fn(() => ({
		gt: mockGt,
		bd: mockBd
	}))
}));

// Import after mocking
import { GET } from '../mail/+server';

// Helper to create request event
function createRequestEvent() {
	const url = new URL('http://localhost/api/gastown/mail');
	return {
		request: new Request(url),
		locals: {},
		params: {},
		url,
		platform: undefined,
		cookies: {} as any,
		fetch: fetch,
		getClientAddress: () => '127.0.0.1',
		setHeaders: vi.fn(),
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '/api/gastown/mail' }
	};
}

// Sample mail bead data
const mockMailBeads = [
	{
		id: 'mail-001',
		title: 'POLECAT_DONE: Task gu-001 completed',
		description: 'The task has been completed successfully.',
		status: 'open',
		priority: 2,
		issue_type: 'message',
		assignee: 'refinery',
		created_at: '2026-01-20T14:00:00Z',
		created_by: 'polecat-1',
		updated_at: '2026-01-20T14:00:00Z',
		labels: ['thread:conv-001'],
		ephemeral: true
	},
	{
		id: 'mail-002',
		title: 'ESCALATION: Build failed',
		description: 'The build failed with exit code 1.',
		status: 'open',
		priority: 1,
		issue_type: 'message',
		assignee: 'witness',
		created_at: '2026-01-20T12:00:00Z',
		created_by: 'refinery',
		updated_at: '2026-01-20T12:30:00Z',
		labels: [],
		ephemeral: false
	},
	{
		id: 'mail-003',
		title: 'Regular message',
		description: 'Just a normal message.',
		status: 'closed',
		priority: 3,
		issue_type: 'message',
		assignee: 'human',
		created_at: '2026-01-19T10:00:00Z',
		created_by: 'system',
		updated_at: '2026-01-19T10:00:00Z',
		labels: ['thread:conv-002'],
		ephemeral: false
	}
];

describe('GET /api/gastown/mail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('Success Cases', () => {
		it('returns messages with expected structure', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: mockMailBeads,
				error: null,
				exitCode: 0,
				duration: 100,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.messages).toHaveLength(3);
			expect(data.unreadCount).toBeDefined();
			expect(data.fetchedAt).toBeDefined();
			expect(data.requestId).toBeDefined();
			expect(data.error).toBeNull();
		});

		it('calls bd with correct arguments', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			await GET(createRequestEvent());

			expect(mockBd).toHaveBeenCalledTimes(1);
			expect(mockBd).toHaveBeenCalledWith(['list', '--type=message', '--status=open', '--json']);
		});

		it('sorts messages by timestamp descending', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: mockMailBeads,
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			// Messages should be sorted newest first
			expect(new Date(data.messages[0].timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date(data.messages[1].timestamp).getTime()
			);
			expect(new Date(data.messages[1].timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date(data.messages[2].timestamp).getTime()
			);
		});
	});

	describe('Message Type Detection', () => {
		it('detects POLECAT_DONE message type', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[0]],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('POLECAT_DONE');
		});

		it('detects ESCALATION message type', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[1]],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('ESCALATION');
		});

		it('defaults to MESSAGE type for regular messages', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[2]],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('MESSAGE');
		});

		it('detects HANDOFF in subject', async () => {
			const handoffBead = {
				...mockMailBeads[0],
				title: 'Your HANDOFF is ready'
			};
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [handoffBead],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('HANDOFF');
		});

		it('detects DONE in subject', async () => {
			const doneBead = {
				...mockMailBeads[0],
				title: 'Work is DONE'
			};
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [doneBead],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('DONE');
		});

		it('detects ERROR in subject', async () => {
			const errorBead = {
				...mockMailBeads[0],
				title: 'ERROR occurred during build'
			};
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [errorBead],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].messageType).toBe('ERROR');
		});
	});

	describe('Message Transformation', () => {
		it('transforms bead to message format', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[0]],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			const message = data.messages[0];
			expect(message.id).toBe('mail-001');
			expect(message.from).toBe('polecat-1');
			expect(message.subject).toBe('POLECAT_DONE: Task gu-001 completed');
			expect(message.body).toBe('The task has been completed successfully.');
			expect(message.timestamp).toBe('2026-01-20T14:00:00Z');
		});

		it('marks open status as unread', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[0]], // status: 'open'
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].read).toBe(false);
		});

		it('marks non-open status as read', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[2]], // status: 'closed'
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].read).toBe(true);
		});

		it('maps priority correctly', async () => {
			const highPriorityBead = { ...mockMailBeads[0], priority: 1 };
			const normalPriorityBead = { ...mockMailBeads[1], priority: 2 };
			const lowPriorityBead = { ...mockMailBeads[2], priority: 3 };

			mockBd.mockResolvedValueOnce({
				success: true,
				data: [highPriorityBead, normalPriorityBead, lowPriorityBead],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			// Find messages by ID since they're sorted by timestamp
			const high = data.messages.find((m: any) => m.id === 'mail-001');
			const normal = data.messages.find((m: any) => m.id === 'mail-002');
			const low = data.messages.find((m: any) => m.id === 'mail-003');

			expect(high.priority).toBe('high');
			expect(normal.priority).toBe('normal');
			expect(low.priority).toBe('low');
		});

		it('extracts thread ID from labels', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[0]], // has thread:conv-001 label
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].threadId).toBe('conv-001');
		});

		it('handles missing thread label', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [mockMailBeads[1]], // no thread label
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].threadId).toBe('');
		});

		it('handles missing labels array', async () => {
			const beadWithoutLabels = { ...mockMailBeads[0], labels: undefined };
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [beadWithoutLabels],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].threadId).toBe('');
		});
	});

	describe('Unread Count', () => {
		it('counts unread messages correctly', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: mockMailBeads, // 2 open (unread), 1 closed (read)
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.unreadCount).toBe(2);
		});

		it('returns 0 when all messages are read', async () => {
			const allRead = mockMailBeads.map((b) => ({ ...b, status: 'closed' }));
			mockBd.mockResolvedValueOnce({
				success: true,
				data: allRead,
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.unreadCount).toBe(0);
		});
	});

	describe('Error Handling', () => {
		it('returns 500 when CLI returns error', async () => {
			mockBd.mockResolvedValueOnce({
				success: false,
				data: null,
				error: 'Database connection failed',
				exitCode: 1,
				duration: 100,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('Database connection failed');
			expect(data.messages).toEqual([]);
			expect(data.unreadCount).toBe(0);
			expect(data.requestId).toBeDefined();
		});

		it('returns 500 when CLI throws exception', async () => {
			mockBd.mockRejectedValueOnce(new Error('CLI process timed out'));

			const response = await GET(createRequestEvent());

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('CLI process timed out');
			expect(data.messages).toEqual([]);
			expect(data.unreadCount).toBe(0);
			expect(data.requestId).toBeDefined();
		});

		it('handles non-Error exceptions gracefully', async () => {
			mockBd.mockRejectedValueOnce('Unknown string error');

			const response = await GET(createRequestEvent());

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('Failed to fetch mail inbox');
			expect(data.requestId).toBeDefined();
		});

		it('includes requestId in all error responses', async () => {
			mockBd.mockResolvedValueOnce({
				success: false,
				data: null,
				error: 'Some error',
				exitCode: 1,
				duration: 10,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());

			const data = await response.json();
			expect(data.requestId).toBeDefined();
			expect(data.requestId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);
		});
	});

	describe('Empty Results', () => {
		it('returns empty array when no messages', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [],
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.messages).toEqual([]);
			expect(data.unreadCount).toBe(0);
			expect(data.error).toBeNull();
			expect(data.requestId).toBeDefined();
		});

		it('handles null data as empty array', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: null,
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());

			const data = await response.json();
			expect(data.messages).toEqual([]);
			expect(data.unreadCount).toBe(0);
		});
	});

	describe('Mock Isolation', () => {
		it('mocks are reset between tests - first test', async () => {
			mockBd.mockResolvedValueOnce({
				success: true,
				data: [{ ...mockMailBeads[0], title: 'First test message' }],
				error: null,
				exitCode: 0,
				duration: 10,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].subject).toBe('First test message');
			expect(mockBd).toHaveBeenCalledTimes(1);
		});

		it('mocks are reset between tests - second test', async () => {
			// Verify previous mock doesn't leak
			expect(mockBd).toHaveBeenCalledTimes(0);

			mockBd.mockResolvedValueOnce({
				success: true,
				data: [{ ...mockMailBeads[0], title: 'Second test message' }],
				error: null,
				exitCode: 0,
				duration: 10,
				command: 'bd list --type=message --status=open --json'
			});

			const response = await GET(createRequestEvent());
			const data = await response.json();

			expect(data.messages[0].subject).toBe('Second test message');
		});
	});
});
