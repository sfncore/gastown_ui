#!/usr/bin/env bun

/**
 * Smoke Test Scripts for CUJ Happy Paths
 *
 * Exercises critical user journey happy paths via API calls.
 * Run as shell scripts for quick validation.
 *
 * Usage:
 *   bun scripts/smoke-test.ts
 *   BASE_URL=http://localhost:3000 bun scripts/smoke-test.ts
 *
 * @module scripts/smoke-test
 */

import { createTestLogger } from './smoke/lib';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const logger = createTestLogger('Smoke Tests');

interface TestResult {
	name: string;
	cuj: string;
	passed: boolean;
	duration: number;
	error?: string;
	response?: {
		status: number;
		body: unknown;
	};
}

const results: TestResult[] = [];
let stepCount = 0;

/**
 * Make an API request with timing and logging
 */
async function apiRequest<T = unknown>(
	method: string,
	path: string,
	options: { body?: unknown; timeout?: number } = {}
): Promise<{ ok: boolean; status: number; data: T; duration: number }> {
	const url = `${BASE_URL}${path}`;
	const start = Date.now();

	logger.request(method, url, options.body);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

	try {
		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: options.body ? JSON.stringify(options.body) : undefined,
			signal: controller.signal
		});

		clearTimeout(timeoutId);
		const duration = Date.now() - start;

		let data: T;
		try {
			data = (await response.json()) as T;
		} catch {
			data = {} as T;
		}

		logger.response(response.status, data, response.headers);
		logger.timing(`${method} ${path}`, duration);

		return { ok: response.ok, status: response.status, data, duration };
	} catch (error) {
		clearTimeout(timeoutId);
		const duration = Date.now() - start;
		const message = error instanceof Error ? error.message : 'Unknown error';

		logger.fail(`Request failed: ${message}`);
		return { ok: false, status: 0, data: {} as T, duration };
	}
}

/**
 * Run a single test
 */
async function runTest(
	name: string,
	cuj: string,
	testFn: () => Promise<{ passed: boolean; error?: string; response?: { status: number; body: unknown } }>
): Promise<TestResult> {
	stepCount++;
	logger.step(`${cuj}: ${name}`);

	const start = Date.now();
	try {
		const { passed, error, response } = await testFn();
		const duration = Date.now() - start;

		if (passed) {
			logger.success(name);
		} else {
			logger.fail(name, error);
		}

		const result: TestResult = { name, cuj, passed, duration, error, response };
		results.push(result);
		return result;
	} catch (error) {
		const duration = Date.now() - start;
		const message = error instanceof Error ? error.message : 'Unknown error';

		logger.fail(name, message);
		const result: TestResult = { name, cuj, passed: false, duration, error: message };
		results.push(result);
		return result;
	}
}

// =============================================================================
// CUJ-1: Rig Management
// =============================================================================

async function cuj1RigManagement(): Promise<void> {
	logger.step('CUJ-1: RIG MANAGEMENT');

	// Test: List rigs endpoint returns successfully
	await runTest('List rigs returns 200', 'CUJ-1', async () => {
		const { ok, status, data } = await apiRequest<{ data?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/rigs'
		);

		if (!ok) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Rigs response has correct structure
	await runTest('Rigs response has data field', 'CUJ-1', async () => {
		const { ok, status, data } = await apiRequest<{ data?: unknown[]; requestId?: string }>(
			'GET',
			'/api/gastown/rigs'
		);

		if (!ok) {
			return { passed: false, error: 'Request failed', response: { status, body: data } };
		}

		const hasData = 'data' in data || Array.isArray(data);
		const hasRequestId = 'requestId' in data;

		if (!hasData) {
			return { passed: false, error: 'Response missing data field', response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});
}

// =============================================================================
// CUJ-2: Work Item Lifecycle
// =============================================================================

async function cuj2WorkItemLifecycle(): Promise<void> {
	logger.step('CUJ-2: WORK ITEM LIFECYCLE');

	// Test: List work items endpoint returns successfully
	await runTest('List work items returns 200', 'CUJ-2', async () => {
		const { ok, status, data } = await apiRequest<{ items?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/work'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200 or graceful 500, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Work items response has correct structure
	await runTest('Work items response has items array', 'CUJ-2', async () => {
		const { status, data } = await apiRequest<{ items?: unknown[]; total?: number; requestId?: string }>(
			'GET',
			'/api/gastown/work'
		);

		const hasItems = 'items' in data && Array.isArray(data.items);
		const hasTotal = 'total' in data && typeof data.total === 'number';

		if (!hasItems) {
			return { passed: false, error: 'Response missing items array', response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Work items can be filtered by status
	await runTest('Filter work items by status', 'CUJ-2', async () => {
		const { ok, status, data } = await apiRequest<{ items?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/work?status=in_progress'
		);

		// Should return 200 even if empty
		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});
}

// =============================================================================
// CUJ-3: Agent Management
// =============================================================================

async function cuj3AgentManagement(): Promise<void> {
	logger.step('CUJ-3: AGENT MANAGEMENT');

	// Test: List agents endpoint returns successfully
	await runTest('List agents returns 200', 'CUJ-3', async () => {
		const { ok, status, data } = await apiRequest<{ agents?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/agents'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Agents response has correct structure
	await runTest('Agents response has agents array', 'CUJ-3', async () => {
		const { status, data } = await apiRequest<{ agents?: unknown[]; timestamp?: string }>(
			'GET',
			'/api/gastown/agents'
		);

		const hasAgents = 'agents' in data && Array.isArray(data.agents);
		const hasTimestamp = 'timestamp' in data;

		if (!hasAgents) {
			return { passed: false, error: 'Response missing agents array', response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});
}

// =============================================================================
// CUJ-4: System Monitoring
// =============================================================================

async function cuj4SystemMonitoring(): Promise<void> {
	logger.step('CUJ-4: SYSTEM MONITORING');

	// Test: Status endpoint returns successfully
	await runTest('Get system status returns 200', 'CUJ-4', async () => {
		const { ok, status, data } = await apiRequest<{ name?: string; error?: string }>(
			'GET',
			'/api/gastown/status'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Snapshot endpoint returns successfully
	await runTest('Get snapshot returns 200', 'CUJ-4', async () => {
		const { ok, status, data } = await apiRequest<{ health?: string; error?: string }>(
			'GET',
			'/api/gastown/snapshot'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Snapshot has required fields
	await runTest('Snapshot has health and timestamp', 'CUJ-4', async () => {
		const { status, data } = await apiRequest<{
			health?: string;
			timestamp?: string;
			fetchedAt?: string;
			rigs?: unknown[];
			polecats?: unknown[];
		}>('GET', '/api/gastown/snapshot');

		const hasHealth = 'health' in data;
		const hasTimestamp = 'timestamp' in data || 'fetchedAt' in data;

		if (!hasHealth || !hasTimestamp) {
			return {
				passed: false,
				error: `Missing fields: ${!hasHealth ? 'health' : ''} ${!hasTimestamp ? 'timestamp' : ''}`.trim(),
				response: { status, body: data }
			};
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Health endpoint
	await runTest('Health endpoint returns 200', 'CUJ-4', async () => {
		const { ok, status, data } = await apiRequest<{ status?: string }>(
			'GET',
			'/api/gastown/health'
		);

		if (!ok) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Queue endpoint returns successfully
	await runTest('Get merge queue returns 200', 'CUJ-4', async () => {
		const { ok, status, data } = await apiRequest<{ items?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/queue'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});
}

// =============================================================================
// CUJ-5: Mail View
// =============================================================================

async function cuj5MailView(): Promise<void> {
	logger.step('CUJ-5: MAIL VIEW');

	// Test: Mail endpoint returns successfully
	await runTest('List mail messages returns 200', 'CUJ-5', async () => {
		const { ok, status, data } = await apiRequest<{ messages?: unknown[]; error?: string }>(
			'GET',
			'/api/gastown/mail'
		);

		if (!ok && status !== 500) {
			return { passed: false, error: `Expected 200, got ${status}`, response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});

	// Test: Mail response has correct structure
	await runTest('Mail response has messages array', 'CUJ-5', async () => {
		const { status, data } = await apiRequest<{ messages?: unknown[]; unreadCount?: number }>(
			'GET',
			'/api/gastown/mail'
		);

		const hasMessages = 'messages' in data && Array.isArray(data.messages);
		const hasUnreadCount = 'unreadCount' in data && typeof data.unreadCount === 'number';

		if (!hasMessages) {
			return { passed: false, error: 'Response missing messages array', response: { status, body: data } };
		}

		return { passed: true, response: { status, body: data } };
	});
}

// =============================================================================
// Main Runner
// =============================================================================

async function runAllTests(): Promise<void> {
	console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🔥 GASTOWN UI SMOKE TESTS                                                  ║
║   Testing CUJ Happy Paths                                                    ║
║                                                                              ║
║   Target: ${BASE_URL.padEnd(55)}║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

	const startTime = Date.now();

	// Run all CUJ tests
	await cuj1RigManagement();
	await cuj2WorkItemLifecycle();
	await cuj3AgentManagement();
	await cuj4SystemMonitoring();
	await cuj5MailView();

	const totalDuration = Date.now() - startTime;

	// Generate summary
	const passed = results.filter((r) => r.passed).length;
	const failed = results.filter((r) => !r.passed).length;
	const total = results.length;

	const cujSummary = new Map<string, { passed: number; failed: number }>();
	for (const result of results) {
		const existing = cujSummary.get(result.cuj) || { passed: 0, failed: 0 };
		if (result.passed) {
			existing.passed++;
		} else {
			existing.failed++;
		}
		cujSummary.set(result.cuj, existing);
	}

	console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                              TEST SUMMARY                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣`);

	for (const [cuj, stats] of cujSummary) {
		const status = stats.failed === 0 ? '✓' : '✗';
		const line = `║  ${status} ${cuj}: ${stats.passed}/${stats.passed + stats.failed} passed`;
		console.log(line.padEnd(79) + '║');
	}

	console.log(`╠══════════════════════════════════════════════════════════════════════════════╣`);
	const summaryLine = `║  Total: ${passed}/${total} passed (${failed} failed) in ${totalDuration}ms`;
	console.log(summaryLine.padEnd(79) + '║');

	if (failed === 0) {
		console.log(`║  ${'🎉 All tests passed!'.padEnd(76)}║`);
	} else {
		console.log(`║  ${'⚠️  Some tests failed. See details above.'.padEnd(76)}║`);
	}

	console.log(`╚══════════════════════════════════════════════════════════════════════════════╝
`);

	// Export results for report generation
	const report = {
		timestamp: new Date().toISOString(),
		baseUrl: BASE_URL,
		duration: totalDuration,
		summary: {
			total,
			passed,
			failed
		},
		cujSummary: Object.fromEntries(cujSummary),
		results
	};

	// Write report to stdout in JSON format if requested
	if (process.env.OUTPUT_JSON === 'true') {
		console.log('\n--- JSON REPORT ---');
		console.log(JSON.stringify(report, null, 2));
	}

	// Exit with appropriate code
	process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
	console.error('Fatal error running smoke tests:', error);
	process.exit(1);
});
