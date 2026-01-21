/**
 * CUJ-5 Mail View Smoke Tests
 *
 * Validates the Mail inbox journey with comprehensive logging for debugging.
 * Tests mail list endpoint, message details, and structure validation.
 *
 * Usage:
 *   bun test scripts/smoke/cuj-5-mail.ts
 *
 * @module scripts/smoke/cuj-5-mail
 */

import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { createTestLogger, type TestLogger } from './lib';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let logger: TestLogger;
let testStartTime: number;
let passedTests = 0;
let totalTests = 0;

interface MailMessage {
	id: string;
	from: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	messageType: string;
	threadId: string;
}

interface MailListResponse {
	messages: MailMessage[];
	unreadCount: number;
	error: string | null;
	fetchedAt: string;
	requestId: string;
}

interface MailDetailResponse {
	message: MailMessage;
	fetchedAt: string;
	requestId: string;
}

beforeAll(() => {
	logger = createTestLogger('CUJ-5: Mail View');
	testStartTime = Date.now();
	logger.step('CUJ-5: MAIL VIEW SMOKE TESTS');
	logger.info(`Base URL: ${BASE_URL}`);
});

afterAll(() => {
	const duration = Date.now() - testStartTime;
	logger.summary('CUJ-5', passedTests === totalTests, duration, totalTests);
});

describe('CUJ-5: Mail Inbox Flow', () => {
	let messages: MailMessage[] = [];

	test('Step 1: Fetch mail list', async () => {
		totalTests++;
		const stepStart = Date.now();
		logger.step('1. Fetching mail list from /api/gastown/mail');

		const url = `${BASE_URL}/api/gastown/mail`;
		logger.request('GET', url);

		const res = await fetch(url);
		const data = (await res.json()) as MailListResponse;

		logger.response(res.status, data);
		expect(res.ok).toBe(true);

		// Validate response structure
		expect(data).toHaveProperty('messages');
		expect(data).toHaveProperty('unreadCount');
		expect(data).toHaveProperty('fetchedAt');
		expect(data).toHaveProperty('requestId');
		expect(Array.isArray(data.messages)).toBe(true);

		messages = data.messages;

		logger.info(`Found ${messages.length} messages in inbox`);
		logger.info(`Unread count: ${data.unreadCount}`);
		for (const msg of messages.slice(0, 3)) {
			logger.info(`  - [${msg.messageType}] ${msg.subject} (${msg.priority})`);
		}

		logger.success('Mail list endpoint validated');
		logger.timing('Step 1', Date.now() - stepStart);
		passedTests++;
	});

	test('Step 2: Fetch message detail (if messages exist)', async () => {
		totalTests++;
		const stepStart = Date.now();
		logger.step('2. Fetching message detail');

		if (messages.length === 0) {
			logger.info('[SKIP] No messages in inbox - skipping detail test');
			logger.timing('Step 2', Date.now() - stepStart);
			passedTests++; // Skip counts as pass
			return;
		}

		const msg = messages[0];
		const url = `${BASE_URL}/api/gastown/mail/${msg.id}`;
		logger.request('GET', url);
		logger.info(`Fetching detail for message: ${msg.id}`);

		const res = await fetch(url);
		const data = (await res.json()) as MailDetailResponse;

		logger.response(res.status, data);
		expect(res.ok).toBe(true);

		// Validate response structure
		expect(data).toHaveProperty('message');
		expect(data).toHaveProperty('fetchedAt');
		expect(data).toHaveProperty('requestId');

		const detail = data.message;

		// Validate detail fields
		logger.info('Validating message detail fields...');
		expect(detail.id).toBe(msg.id);
		logger.info(`  id: ${detail.id}`);
		expect(detail.subject).toBeTruthy();
		logger.info(`  subject: ${detail.subject}`);
		expect(detail.from).toBeTruthy();
		logger.info(`  from: ${detail.from}`);
		expect(detail.body).toBeDefined();
		logger.info(`  body: ${detail.body?.substring(0, 50)}...`);

		logger.success('Message detail validated');
		logger.timing('Step 2', Date.now() - stepStart);
		passedTests++;
	});

	test('Step 3: Validate message structure', async () => {
		totalTests++;
		const stepStart = Date.now();
		logger.step('3. Validating message structure for all messages');

		if (messages.length === 0) {
			logger.info('[SKIP] No messages to validate');
			logger.timing('Step 3', Date.now() - stepStart);
			passedTests++; // Skip counts as pass
			return;
		}

		const validMessageTypes = ['MESSAGE', 'HANDOFF', 'ESCALATION', 'DONE', 'ERROR', 'POLECAT_DONE'];
		const validPriorities = ['low', 'normal', 'high'];

		logger.info(`Validating ${Math.min(messages.length, 5)} messages...`);

		for (const msg of messages.slice(0, 5)) {
			logger.info(`  Checking message ${msg.id}...`);

			expect(msg.id).toBeTruthy();
			logger.info(`    id present: ${msg.id}`);

			if (msg.messageType) {
				// messageType might have custom prefixes, so we check common ones
				const typeValid =
					validMessageTypes.includes(msg.messageType) || msg.messageType.endsWith('_DONE');
				expect(typeValid).toBe(true);
				logger.info(`    messageType: ${msg.messageType}`);
			}

			if (msg.priority) {
				expect(validPriorities).toContain(msg.priority);
				logger.info(`    priority valid: ${msg.priority}`);
			}

			expect(typeof msg.read).toBe('boolean');
			logger.info(`    read: ${msg.read}`);

			expect(msg.timestamp).toBeTruthy();
			logger.info(`    timestamp: ${msg.timestamp}`);
		}

		logger.success('All message structures validated');
		logger.timing('Step 3', Date.now() - stepStart);
		passedTests++;
	});

	test('Step 4: Test invalid message ID handling', async () => {
		totalTests++;
		const stepStart = Date.now();
		logger.step('4. Testing error handling for invalid message ID');

		const invalidId = 'nonexistent-id-12345';
		const url = `${BASE_URL}/api/gastown/mail/${invalidId}`;
		logger.request('GET', url);
		logger.info(`Fetching non-existent message: ${invalidId}`);

		const res = await fetch(url);
		const data = await res.json();

		logger.response(res.status, data);

		// Should return 404 for non-existent message
		expect(res.status).toBe(404);
		expect(data).toHaveProperty('error');

		logger.success('Error handling works correctly for invalid IDs');
		logger.timing('Step 4', Date.now() - stepStart);
		passedTests++;
	});
});

/**
 * Print a manual verification checklist
 */
export function printChecklist() {
	console.log(`
=======================================================================
  CUJ-5 MAIL VIEW - MANUAL VERIFICATION CHECKLIST
=======================================================================

SECTION 1: MAIL LIST VIEW
-------------------------
[ ] Navigate to /mail
[ ] Verify inbox shows message list
[ ] Verify message preview shows subject, sender, priority
[ ] Verify unread count is displayed
[ ] Verify messages are sorted by timestamp (newest first)

SECTION 2: MESSAGE DETAIL
-------------------------
[ ] Click message to view detail
[ ] Verify detail shows full body
[ ] Verify detail shows from, subject, timestamp
[ ] Verify priority badge is displayed
[ ] Verify message type badge is displayed
[ ] Test back navigation

SECTION 3: EMPTY STATE
----------------------
[ ] Verify empty state when no messages
[ ] Verify appropriate message displayed

SECTION 4: ERROR HANDLING
-------------------------
[ ] Navigate to /mail/invalid-id
[ ] Verify 404 error is handled gracefully
[ ] Verify error message is displayed

=======================================================================
  To run automated tests: bun test scripts/smoke/cuj-5-mail.ts
=======================================================================
`);
}
