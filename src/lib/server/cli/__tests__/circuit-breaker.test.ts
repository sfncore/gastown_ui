import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';
import { createTestLogger } from '../../../../../scripts/smoke/lib/logger';

const logger = createTestLogger('Unit: Circuit Breaker');
let testStartTime: number;
let stepCount = 0;

describe('CircuitBreaker', () => {
	let breaker: CircuitBreaker;

	beforeEach(() => {
		breaker = new CircuitBreaker(3, 1000);
		testStartTime = Date.now();
		stepCount = 0;
	});

	afterAll(() => {
		const duration = Date.now() - testStartTime;
		logger.summary('CircuitBreaker Tests', true, duration, stepCount);
	});

	describe('State Transitions', () => {
		it('starts in CLOSED state', () => {
			stepCount++;
			logger.step('Verify initial CLOSED state');
			logger.info('Creating new circuit breaker', { threshold: 3, resetTime: 1000 });

			const state = breaker.getState();
			logger.info('Initial state', { state });

			expect(state).toBe('CLOSED');
			expect(breaker.canExecute()).toBe(true);
			logger.success('Circuit breaker starts in CLOSED state');
		});

		it('opens after threshold failures', () => {
			stepCount++;
			logger.step('Verify circuit opens after threshold failures');

			for (let i = 0; i < 3; i++) {
				logger.info(`Recording failure ${i + 1}/3`);
				breaker.recordFailure();
				logger.info('State after failure', { state: breaker.getState(), stats: breaker.getStats() });
			}

			expect(breaker.getState()).toBe('OPEN');
			expect(breaker.canExecute()).toBe(false);
			logger.success('Circuit opened after 3 consecutive failures');
		});

		it('transitions to HALF_OPEN after timeout', async () => {
			stepCount++;
			logger.step('Verify HALF_OPEN transition after timeout');

			// Use short timeout for test
			breaker = new CircuitBreaker(1, 50);
			logger.info('Created breaker with short timeout', { threshold: 1, resetTime: 50 });

			breaker.recordFailure();
			logger.info('Recorded failure to open circuit', { state: breaker.getState() });

			expect(breaker.getState()).toBe('OPEN');
			expect(breaker.canExecute()).toBe(false);

			logger.info('Waiting for timeout period (60ms)...');
			await new Promise((r) => setTimeout(r, 60));

			const canExecute = breaker.canExecute();
			logger.info('After timeout', { canExecute, state: breaker.getState() });

			expect(canExecute).toBe(true);
			expect(breaker.getState()).toBe('HALF_OPEN');
			logger.success('Circuit transitioned to HALF_OPEN after timeout');
		});

		it('closes on successful probe in HALF_OPEN', async () => {
			stepCount++;
			logger.step('Verify CLOSED transition on successful HALF_OPEN probes');

			breaker = new CircuitBreaker(1, 50);
			logger.info('Created breaker', { threshold: 1, resetTime: 50 });

			breaker.recordFailure();
			await new Promise((r) => setTimeout(r, 60));
			breaker.canExecute(); // Trigger transition to HALF_OPEN
			logger.info('Circuit in HALF_OPEN', { state: breaker.getState() });

			// Record successes (need 2 for half-open success threshold)
			logger.info('Recording first success');
			breaker.recordSuccess();
			logger.info('State after first success', { state: breaker.getState(), stats: breaker.getStats() });

			logger.info('Recording second success');
			breaker.recordSuccess();
			logger.info('State after second success', { state: breaker.getState(), stats: breaker.getStats() });

			expect(breaker.getState()).toBe('CLOSED');
			logger.success('Circuit closed after successful probes in HALF_OPEN');
		});

		it('returns to OPEN on failure in HALF_OPEN', async () => {
			stepCount++;
			logger.step('Verify OPEN transition on HALF_OPEN failure');

			breaker = new CircuitBreaker(1, 50);
			logger.info('Created breaker', { threshold: 1, resetTime: 50 });

			breaker.recordFailure();
			await new Promise((r) => setTimeout(r, 60));
			breaker.canExecute(); // Trigger transition to HALF_OPEN
			logger.info('Circuit in HALF_OPEN', { state: breaker.getState() });

			logger.info('Recording failure during HALF_OPEN');
			breaker.recordFailure();
			logger.info('State after failure', { state: breaker.getState() });

			expect(breaker.getState()).toBe('OPEN');
			logger.success('Circuit returned to OPEN on HALF_OPEN failure');
		});
	});

	describe('Failure Tracking', () => {
		it('counts consecutive failures', () => {
			stepCount++;
			logger.step('Verify consecutive failure counting');

			logger.info('Recording 2 failures (below threshold)');
			breaker.recordFailure();
			breaker.recordFailure();

			const stats = breaker.getStats();
			logger.info('Stats after 2 failures', stats);

			expect(stats.failureCount).toBe(2);
			expect(breaker.getState()).toBe('CLOSED');
			logger.success('Failure count tracked correctly');
		});

		it('resets count on success', () => {
			stepCount++;
			logger.step('Verify failure count reset on success');

			logger.info('Recording 2 failures');
			breaker.recordFailure();
			breaker.recordFailure();
			logger.info('Stats before success', breaker.getStats());

			logger.info('Recording success');
			breaker.recordSuccess();
			logger.info('Stats after success', breaker.getStats());

			expect(breaker.getStats().failureCount).toBe(0);
			logger.success('Failure count reset on success');
		});

		it('threshold is configurable', () => {
			stepCount++;
			logger.step('Verify configurable threshold');

			// Test with threshold of 5
			const customBreaker = new CircuitBreaker(5, 1000);
			logger.info('Created breaker with threshold 5');

			for (let i = 0; i < 4; i++) {
				customBreaker.recordFailure();
			}
			logger.info('After 4 failures', { state: customBreaker.getState(), stats: customBreaker.getStats() });
			expect(customBreaker.getState()).toBe('CLOSED');

			customBreaker.recordFailure();
			logger.info('After 5th failure', { state: customBreaker.getState() });
			expect(customBreaker.getState()).toBe('OPEN');

			logger.success('Threshold is configurable');
		});
	});

	describe('Open State Behavior', () => {
		it('rejects requests immediately when open', () => {
			stepCount++;
			logger.step('Verify immediate rejection when OPEN');

			// Open the circuit
			for (let i = 0; i < 3; i++) {
				breaker.recordFailure();
			}
			logger.info('Circuit opened', { state: breaker.getState() });

			const canExecute = breaker.canExecute();
			logger.info('canExecute() result', { canExecute });

			expect(canExecute).toBe(false);
			logger.success('Requests rejected immediately when circuit OPEN');
		});

		it('allows probe request after timeout', async () => {
			stepCount++;
			logger.step('Verify probe allowed after timeout');

			breaker = new CircuitBreaker(1, 50);
			breaker.recordFailure();
			logger.info('Circuit opened', { state: breaker.getState() });

			expect(breaker.canExecute()).toBe(false);
			logger.info('Request rejected before timeout');

			await new Promise((r) => setTimeout(r, 60));

			const canExecute = breaker.canExecute();
			logger.info('After timeout', { canExecute, state: breaker.getState() });

			expect(canExecute).toBe(true);
			expect(breaker.getState()).toBe('HALF_OPEN');
			logger.success('Probe request allowed after timeout');
		});
	});

	describe('Manual Reset', () => {
		it('reset() returns to CLOSED state', () => {
			stepCount++;
			logger.step('Verify manual reset');

			// Open the circuit
			for (let i = 0; i < 3; i++) {
				breaker.recordFailure();
			}
			logger.info('Circuit opened', { state: breaker.getState(), stats: breaker.getStats() });

			breaker.reset();
			logger.info('After reset()', { state: breaker.getState(), stats: breaker.getStats() });

			expect(breaker.getState()).toBe('CLOSED');
			expect(breaker.getStats().failureCount).toBe(0);
			expect(breaker.getStats().successCount).toBe(0);
			logger.success('Manual reset returns circuit to CLOSED state');
		});
	});
});
