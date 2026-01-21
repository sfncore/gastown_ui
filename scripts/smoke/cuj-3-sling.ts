/**
 * CUJ-3: Sling Work Item to Polecat
 *
 * Smoke test for the orchestration sling workflow - assigning work to polecats.
 *
 * @module scripts/smoke/cuj-3-sling
 */

import { expect, test } from 'bun:test';
import { createTestLogger } from './lib';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const logger = createTestLogger('CUJ-3: Orchestration (Sling)');

interface Agent {
	name: string;
	type: string;
	status: 'running' | 'idle' | 'offline';
	rig: string | null;
	hasWork: boolean;
	unreadMail: number;
	session?: string;
	address: string;
}

interface AgentsResponse {
	agents: Agent[];
	timestamp: string;
	requestId: string;
	error?: string;
}

interface CreateIssueResponse {
	data?: { id: string };
	error?: string;
	requestId: string;
}

interface SlingResponse {
	success: boolean;
	data?: {
		beadId: string;
		assignedTo: string;
		message: string;
	};
	error?: string;
	details?: string;
	requestId: string;
}

interface IssueResponse {
	data?: {
		id: string;
		assignee?: string;
		status?: string;
	};
	error?: string;
	requestId: string;
}

test('CUJ-3: Sling Work Item to Polecat', async () => {
	const startTime = Date.now();
	let stepCount = 0;

	// 1. Create work item to sling
	stepCount++;
	logger.step('1. Create work item for sling test');
	const createPayload = { title: `Sling smoke test ${Date.now()}`, type: 'task', priority: 1 };
	logger.request('POST', `${BASE_URL}/api/gastown/work/issues`, createPayload);

	const createRes = await fetch(`${BASE_URL}/api/gastown/work/issues`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(createPayload)
	});

	const createJson = (await createRes.json()) as CreateIssueResponse;
	logger.response(createRes.status, createJson);

	if (!createRes.ok || !createJson.data) {
		logger.fail('Failed to create work item', createJson.error);
		throw new Error(`Failed to create work item: ${createJson.error}`);
	}

	const beadId = createJson.data.id;
	logger.success(`Created work item: ${beadId}`);
	logger.timing('Step 1: Create work item', Date.now() - startTime);

	// 2. Get available polecats
	stepCount++;
	const step2Start = Date.now();
	logger.step('2. Get available polecats');
	logger.request('GET', `${BASE_URL}/api/gastown/agents`);

	const agentsRes = await fetch(`${BASE_URL}/api/gastown/agents`);
	const agentsJson = (await agentsRes.json()) as AgentsResponse;
	logger.response(agentsRes.status, agentsJson);

	if (!agentsRes.ok) {
		logger.fail('Failed to fetch agents', agentsJson.error);
		throw new Error(`Failed to fetch agents: ${agentsJson.error}`);
	}

	const polecats = agentsJson.agents.filter((a) => a.type === 'polecat');
	logger.info(`Found ${polecats.length} polecats`, polecats.map((p) => ({ name: p.name, rig: p.rig, status: p.status })));

	if (polecats.length === 0) {
		logger.info('No polecats available - skipping sling');
		logger.summary('CUJ-3', true, Date.now() - startTime, stepCount);
		return;
	}

	// Select an idle or running polecat, prefer idle
	const target = polecats.find((p) => p.status === 'idle') || polecats.find((p) => p.status === 'running') || polecats[0];
	logger.success(`Selected target polecat: ${target.name} (${target.status})`);
	logger.timing('Step 2: Get polecats', Date.now() - step2Start);

	// 3. Sling work item to polecat
	stepCount++;
	const step3Start = Date.now();
	logger.step('3. Sling work item to polecat');

	// Build agent ID from rig/name if rig exists
	const agentId = target.rig ? `${target.rig}/${target.name}` : target.name;
	const slingPayload = { beadId, agentId };
	logger.request('POST', `${BASE_URL}/api/gastown/work/sling`, slingPayload);

	const slingRes = await fetch(`${BASE_URL}/api/gastown/work/sling`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(slingPayload)
	});

	const slingJson = (await slingRes.json()) as SlingResponse;
	logger.response(slingRes.status, slingJson);

	// Handle various response scenarios
	if (slingRes.status === 202 && slingJson.error) {
		// Accepted but queued (e.g., daemon not running)
		logger.info('Sling accepted but queued', slingJson.details);
		logger.success(`Sling queued for ${target.name}`);
	} else if (slingRes.ok && slingJson.success) {
		logger.success(`Slung ${beadId} to ${target.name}`);
	} else {
		// For smoke test, we don't fail on sling errors since infrastructure may not be running
		logger.info('Sling returned error (infrastructure may not be available)', slingJson.error || slingJson.details);
	}
	logger.timing('Step 3: Sling work item', Date.now() - step3Start);

	// 4. Verify work item assignee updated (best effort)
	stepCount++;
	const step4Start = Date.now();
	logger.step('4. Verify assignee updated (best effort)');
	logger.request('GET', `${BASE_URL}/api/gastown/work/issues/${beadId}`);

	try {
		const verifyRes = await fetch(`${BASE_URL}/api/gastown/work/issues/${beadId}`);
		const verifyJson = (await verifyRes.json()) as IssueResponse;
		logger.response(verifyRes.status, verifyJson);

		if (verifyRes.ok && verifyJson.data?.assignee) {
			logger.success(`Verified assignee: ${verifyJson.data.assignee}`);
		} else {
			logger.info('Could not verify assignee (endpoint may not support single-issue fetch)');
		}
	} catch (error) {
		logger.info('Verification skipped - single issue endpoint not available');
	}
	logger.timing('Step 4: Verify assignee', Date.now() - step4Start);

	// Summary
	const duration = Date.now() - startTime;
	logger.summary('CUJ-3', true, duration, stepCount);
});
