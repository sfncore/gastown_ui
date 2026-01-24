/**
 * Capabilities Probe Tests
 *
 * Tests for CLI version detection, degraded mode, caching, and refresh.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createTestLogger } from '../../../../scripts/smoke/lib/logger';
import {
	probeCapabilities,
	clearCapabilitiesCache
} from '../../server/cli/capabilities';
import * as processSupervisorModule from '../../server/cli/process-supervisor';

const logger = createTestLogger('Unit: Capabilities Probe');

// Mock the process supervisor module
vi.mock('../../server/cli/process-supervisor', () => {
	const mockSupervisor = {
		gt: vi.fn(),
		bd: vi.fn()
	};
	return {
		getProcessSupervisor: vi.fn(() => mockSupervisor),
		resetProcessSupervisor: vi.fn()
	};
});

function getMockSupervisor() {
	return processSupervisorModule.getProcessSupervisor() as {
		gt: Mock;
		bd: Mock;
	};
}

describe('Capabilities Probe', () => {
	beforeEach(() => {
		logger.step('Setting up capabilities probe test');
		clearCapabilitiesCache();
		vi.clearAllMocks();
	});

	describe('Version Detection', () => {
		it('detects gt CLI version', async () => {
			logger.step('Testing gt version detection');
			logger.info('Running: gt --version');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 1.2.3',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 0.5.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Detected capabilities', caps);
			expect(caps.gtVersion).toMatch(/\d+\.\d+\.\d+/);
			expect(caps.gtVersion).toBe('1.2.3');
			logger.success(`Detected gt version: ${caps.gtVersion}`);
		});

		it('detects bd CLI version', async () => {
			logger.step('Testing bd version detection');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'beads daemon v0.8.1 (built 2026-01-15)',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('bd capabilities', caps);
			expect(caps.bdVersion).toBe('0.8.1');
			logger.success(`Detected bd version: ${caps.bdVersion}`);
		});

		it('parses version from various output formats', async () => {
			logger.step('Testing version parsing from different formats');

			const mockSupervisor = getMockSupervisor();

			// Test format: "gt version X.Y.Z"
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 2.0.0\nBuilt with love',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'v1.0.0-beta',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();
			logger.info('Parsed versions', { gt: caps.gtVersion, bd: caps.bdVersion });

			expect(caps.gtVersion).toBe('2.0.0');
			expect(caps.bdVersion).toBe('1.0.0');
			logger.success('Version parsing handles various formats');
		});
	});

	describe('Degraded Mode', () => {
		it('returns degraded mode if gt CLI unavailable', async () => {
			logger.step('Testing degraded mode when gt unavailable');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: false,
				data: null,
				error: 'Command not found: gt',
				exitCode: 127,
				duration: 10,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Capabilities with gt unavailable', caps);
			expect(caps.gtVersion).toBeNull();
			expect(caps.bdVersion).toBe('1.0.0');
			expect(caps.available).toBe(true); // bd is still available
			expect(caps.features.mail).toBe(false); // mail requires gt
			expect(caps.features.work).toBe(true); // work requires bd
			logger.success('Degraded mode: gt unavailable, bd works');
		});

		it('returns degraded mode if bd CLI unavailable', async () => {
			logger.step('Testing degraded mode when bd unavailable');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 0.3.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: false,
				data: null,
				error: 'Command not found: bd',
				exitCode: 127,
				duration: 10,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Capabilities with bd unavailable', caps);
			expect(caps.gtVersion).toBe('0.3.0');
			expect(caps.bdVersion).toBeNull();
			expect(caps.available).toBe(true); // gt is still available
			expect(caps.features.mail).toBe(true); // mail requires gt
			expect(caps.features.work).toBe(false); // work requires bd
			expect(caps.features.convoys).toBe(false); // convoys requires bd
			logger.success('Degraded mode: bd unavailable, gt works');
		});

		it('returns fully degraded mode if both CLIs unavailable', async () => {
			logger.step('Testing fully degraded mode');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: false,
				data: null,
				error: 'Command not found: gt',
				exitCode: 127,
				duration: 10,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: false,
				data: null,
				error: 'Command not found: bd',
				exitCode: 127,
				duration: 10,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Fully degraded capabilities', caps);
			expect(caps.gtVersion).toBeNull();
			expect(caps.bdVersion).toBeNull();
			expect(caps.available).toBe(false);
			expect(caps.error).toContain('CLI tools are not available');
			logger.success('Fully degraded mode with error message');
		});
	});

	describe('Feature Flags', () => {
		it('enables workflows for gt version >= 0.2.0', async () => {
			logger.step('Testing workflow feature flag');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 0.2.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Feature flags', caps.features);
			expect(caps.features.workflows).toBe(true);
			logger.success('Workflows enabled for gt 0.2.0');
		});

		it('disables workflows for gt version < 0.2.0', async () => {
			logger.step('Testing workflow feature flag for older version');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 0.1.9',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps = await probeCapabilities();

			logger.info('Feature flags for older gt', caps.features);
			expect(caps.features.workflows).toBe(false);
			logger.success('Workflows disabled for gt 0.1.9');
		});
	});

	describe('Caching', () => {
		it('caches detection results', async () => {
			logger.step('Testing cache behavior');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			// First call - should hit supervisor
			const caps1 = await probeCapabilities();
			logger.info('First probe', { gtVersion: caps1.gtVersion });

			// Second call - should use cache
			const caps2 = await probeCapabilities();
			logger.info('Second probe (cached)', { gtVersion: caps2.gtVersion });

			// Supervisor should only be called once per CLI
			expect(mockSupervisor.gt).toHaveBeenCalledTimes(1);
			expect(mockSupervisor.bd).toHaveBeenCalledTimes(1);

			// Results should be identical
			expect(caps1).toEqual(caps2);
			logger.success('Cache prevents redundant CLI calls');
		});

		it('refreshes cache on demand', async () => {
			logger.step('Testing force refresh');

			const mockSupervisor = getMockSupervisor();

			// First call returns version 1.0.0
			mockSupervisor.gt.mockResolvedValueOnce({
				success: true,
				data: 'gt version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValueOnce({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			const caps1 = await probeCapabilities();
			logger.info('First probe', { gtVersion: caps1.gtVersion });

			// Second call returns version 2.0.0 (simulating upgrade)
			mockSupervisor.gt.mockResolvedValueOnce({
				success: true,
				data: 'gt version 2.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValueOnce({
				success: true,
				data: 'bd version 2.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			// Force refresh should bypass cache
			const caps2 = await probeCapabilities(true);
			logger.info('Force refresh probe', { gtVersion: caps2.gtVersion });

			// Supervisor should be called twice per CLI now
			expect(mockSupervisor.gt).toHaveBeenCalledTimes(2);
			expect(mockSupervisor.bd).toHaveBeenCalledTimes(2);

			// Version should be updated
			expect(caps2.gtVersion).toBe('2.0.0');
			expect(caps2.bdVersion).toBe('2.0.0');
			logger.success('Force refresh bypasses cache and gets new versions');
		});

		it('clears cache with clearCapabilitiesCache', async () => {
			logger.step('Testing explicit cache clear');

			const mockSupervisor = getMockSupervisor();
			mockSupervisor.gt.mockResolvedValue({
				success: true,
				data: 'gt version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'gt --version'
			});
			mockSupervisor.bd.mockResolvedValue({
				success: true,
				data: 'bd version 1.0.0',
				error: null,
				exitCode: 0,
				duration: 50,
				command: 'bd --version'
			});

			// First probe
			await probeCapabilities();
			logger.info('First probe completed');

			// Clear cache
			clearCapabilitiesCache();
			logger.info('Cache cleared');

			// Second probe should hit supervisor again
			await probeCapabilities();
			logger.info('Second probe after cache clear');

			expect(mockSupervisor.gt).toHaveBeenCalledTimes(2);
			expect(mockSupervisor.bd).toHaveBeenCalledTimes(2);
			logger.success('clearCapabilitiesCache forces fresh detection');
		});
	});
});
