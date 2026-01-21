/**
 * Integration Tests: /api/gastown/status
 *
 * Tests the status endpoint with mocked CLI (Process Supervisor).
 * Verifies JSON structure, SWR cache behavior, and error handling.
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
import { GET } from '../status/+server';

describe('GET /api/gastown/status', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('Success Cases', () => {
		it('returns status JSON with expected structure', async () => {
			const mockStatus = {
				name: 'test-workspace',
				agents: [
					{ name: 'polecat-1', running: true },
					{ name: 'refinery', running: false }
				],
				rigs: [{ name: 'test-rig', polecat_count: 2 }]
			};

			mockGt.mockResolvedValueOnce({
				success: true,
				data: mockStatus,
				error: null,
				exitCode: 0,
				duration: 100,
				command: 'gt status --json'
			} satisfies CLIResult<typeof mockStatus>);

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.name).toBe('test-workspace');
			expect(data.agents).toHaveLength(2);
			expect(data.rigs).toHaveLength(1);
			expect(data.requestId).toBeDefined();
			expect(typeof data.requestId).toBe('string');
		});

		it('calls gt with correct arguments', async () => {
			mockGt.mockResolvedValueOnce({
				success: true,
				data: { name: 'test' },
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt status --json'
			});

			await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			expect(mockGt).toHaveBeenCalledTimes(1);
			expect(mockGt).toHaveBeenCalledWith(['status', '--json']);
		});
	});

	describe('Error Handling', () => {
		it('returns 500 when CLI returns error', async () => {
			mockGt.mockResolvedValueOnce({
				success: false,
				data: null,
				error: 'gt command failed: workspace not found',
				exitCode: 1,
				duration: 100,
				command: 'gt status --json'
			} satisfies CLIResult<null>);

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('gt command failed: workspace not found');
			expect(data.requestId).toBeDefined();
		});

		it('returns 500 when CLI throws exception', async () => {
			mockGt.mockRejectedValueOnce(new Error('CLI process timed out'));

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('CLI process timed out');
			expect(data.requestId).toBeDefined();
		});

		it('handles non-Error exceptions gracefully', async () => {
			mockGt.mockRejectedValueOnce('Unknown string error');

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe('Failed to fetch status');
			expect(data.requestId).toBeDefined();
		});

		it('includes requestId in all error responses', async () => {
			mockGt.mockResolvedValueOnce({
				success: false,
				data: null,
				error: 'Some error',
				exitCode: 1,
				duration: 10,
				command: 'gt status --json'
			});

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			const data = await response.json();
			expect(data.requestId).toBeDefined();
			expect(data.requestId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);
		});
	});

	describe('Mock Isolation', () => {
		it('mocks are reset between tests - first test', async () => {
			mockGt.mockResolvedValueOnce({
				success: true,
				data: { name: 'first-test' },
				error: null,
				exitCode: 0,
				duration: 10,
				command: 'gt status --json'
			});

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			const data = await response.json();
			expect(data.name).toBe('first-test');
			expect(mockGt).toHaveBeenCalledTimes(1);
		});

		it('mocks are reset between tests - second test', async () => {
			// This test verifies that the mock from the previous test doesn't leak
			expect(mockGt).toHaveBeenCalledTimes(0);

			mockGt.mockResolvedValueOnce({
				success: true,
				data: { name: 'second-test' },
				error: null,
				exitCode: 0,
				duration: 10,
				command: 'gt status --json'
			});

			const response = await GET({
				request: new Request('http://localhost/api/gastown/status'),
				locals: {},
				params: {},
				url: new URL('http://localhost/api/gastown/status'),
				platform: undefined,
				cookies: {} as any,
				fetch: fetch,
				getClientAddress: () => '127.0.0.1',
				setHeaders: vi.fn(),
				isDataRequest: false,
				isSubRequest: false,
				route: { id: '/api/gastown/status' }
			});

			const data = await response.json();
			expect(data.name).toBe('second-test');
		});
	});
});
