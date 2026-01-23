/**
 * Environment Configuration Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';

// Mock fs existsSync
vi.mock('node:fs', () => ({
	existsSync: vi.fn((path: string) => {
		if (path === '/valid/town/root') return true;
		if (path === '/valid/bd/cwd/.beads') return true;
		if (path === '/valid/bd/cwd') return true;
		return false;
	}),
	default: {
		existsSync: vi.fn((path: string) => {
			if (path === '/valid/town/root') return true;
			if (path === '/valid/bd/cwd/.beads') return true;
			if (path === '/valid/bd/cwd') return true;
			return false;
		})
	}
}));

// Mock child_process execSync for binary checks
vi.mock('node:child_process', () => ({
	execSync: vi.fn((cmd: string) => {
		if (cmd.includes('which gt')) return '/usr/local/bin/gt\n';
		if (cmd.includes('which bd')) return '/usr/local/bin/bd\n';
		throw new Error('Command not found');
	}),
	default: {
		execSync: vi.fn((cmd: string) => {
			if (cmd.includes('which gt')) return '/usr/local/bin/gt\n';
			if (cmd.includes('which bd')) return '/usr/local/bin/bd\n';
			throw new Error('Command not found');
		})
	}
}));

import {
	type GastownConfig,
	type ValidationResult,
	DEFAULT_CONFIG,
	validateConfig,
	loadConfig,
	loadConfigStrict,
	getConfig,
	getConfigStrict,
	resetConfig,
	checkBinaries,
	formatConfigForLogging,
	getCurrentRig,
	getRigConfig
} from './environment';

describe('Environment Configuration', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
		resetConfig();
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.clearAllMocks();
	});

	describe('DEFAULT_CONFIG', () => {
		it('has correct default values', () => {
			expect(DEFAULT_CONFIG.gtBin).toBe('gt');
			expect(DEFAULT_CONFIG.bdBin).toBe('bd');
			expect(DEFAULT_CONFIG.cliTimeout).toBe(30_000);
			expect(DEFAULT_CONFIG.cloneTimeout).toBe(180_000);
			expect(DEFAULT_CONFIG.pollCritical).toBe(5_000);
			expect(DEFAULT_CONFIG.pollStandard).toBe(15_000);
			expect(DEFAULT_CONFIG.pollBackground).toBe(60_000);
			expect(DEFAULT_CONFIG.cacheTTL).toBe(2_000);
			expect(DEFAULT_CONFIG.enableWrites).toBe(false);
			expect(DEFAULT_CONFIG.demoMode).toBe(true);
		});
	});

	describe('loadConfig', () => {
		it('loads config from environment variables', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_HOME = '/home/user/.gastown';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';
			process.env.GASTOWN_GT_BIN = 'custom-gt';
			process.env.GASTOWN_BD_BIN = 'custom-bd';
			process.env.GASTOWN_CLI_TIMEOUT = '60000';
			process.env.GASTOWN_POLL_CRITICAL = '10000';
			process.env.GASTOWN_ENABLE_WRITES = 'true';
			process.env.GASTOWN_DEMO_MODE = 'false';

			const config = loadConfig();

			expect(config.townRoot).toBe('/valid/town/root');
			expect(config.gastownHome).toBe('/home/user/.gastown');
			expect(config.bdCwd).toBe('/valid/bd/cwd');
			expect(config.gtBin).toBe('custom-gt');
			expect(config.bdBin).toBe('custom-bd');
			expect(config.cliTimeout).toBe(60000);
			expect(config.pollCritical).toBe(10000);
			expect(config.enableWrites).toBe(true);
			expect(config.demoMode).toBe(false);
		});

		it('uses defaults for missing environment variables', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config = loadConfig();

			expect(config.gtBin).toBe('gt');
			expect(config.bdBin).toBe('bd');
			expect(config.cliTimeout).toBe(30_000);
			expect(config.pollCritical).toBe(5_000);
			expect(config.enableWrites).toBe(false);
			expect(config.demoMode).toBe(true);
		});

		it('handles invalid number values gracefully', () => {
			process.env.GASTOWN_CLI_TIMEOUT = 'not-a-number';
			process.env.GASTOWN_POLL_CRITICAL = '';

			const config = loadConfig();

			expect(config.cliTimeout).toBe(DEFAULT_CONFIG.cliTimeout);
			expect(config.pollCritical).toBe(DEFAULT_CONFIG.pollCritical);
		});

		it('parses boolean values correctly', () => {
			process.env.GASTOWN_ENABLE_WRITES = 'true';
			let config = loadConfig();
			expect(config.enableWrites).toBe(true);

			resetConfig();
			process.env.GASTOWN_ENABLE_WRITES = '1';
			config = loadConfig();
			expect(config.enableWrites).toBe(true);

			resetConfig();
			process.env.GASTOWN_ENABLE_WRITES = 'false';
			config = loadConfig();
			expect(config.enableWrites).toBe(false);

			resetConfig();
			process.env.GASTOWN_ENABLE_WRITES = '0';
			config = loadConfig();
			expect(config.enableWrites).toBe(false);
		});

		it('builds cliEnv with relevant environment variables', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_HOME = '/home/user/.gastown';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config = loadConfig();

			expect(config.cliEnv.GASTOWN_TOWN_ROOT).toBe('/valid/town/root');
			expect(config.cliEnv.GASTOWN_HOME).toBe('/home/user/.gastown');
			expect(config.cliEnv.GASTOWN_BD_CWD).toBe('/valid/bd/cwd');
		});
	});

	describe('validateConfig', () => {
		const validConfig: GastownConfig = {
			townRoot: '/valid/town/root',
			gastownHome: '/home/user/.gastown',
			bdCwd: '/valid/bd/cwd',
			gtBin: 'gt',
			bdBin: 'bd',
			rigName: 'default',
			cliTimeout: 30_000,
			cloneTimeout: 180_000,
			pollCritical: 5_000,
			pollStandard: 15_000,
			pollBackground: 60_000,
			cacheTTL: 2_000,
			enableWrites: false,
			demoMode: true,
			cliEnv: {}
		};

		it('returns valid for correct config', () => {
			const result = validateConfig(validConfig);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('reports error for missing town root', () => {
			const config = { ...validConfig, townRoot: '' };
			const result = validateConfig(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Town root not configured: GASTOWN_TOWN_ROOT is required');
		});

		it('reports error for invalid town root path', () => {
			const config = { ...validConfig, townRoot: '/invalid/path' };
			const result = validateConfig(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Town root not found: /invalid/path');
		});

		it('reports error for missing bdCwd', () => {
			const config = { ...validConfig, bdCwd: '' };
			const result = validateConfig(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Beads working directory not configured: GASTOWN_BD_CWD is required');
		});

		it('reports error for missing .beads directory', () => {
			const config = { ...validConfig, bdCwd: '/invalid/bd/path' };
			const result = validateConfig(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Beads directory not found: /invalid/bd/path/.beads');
		});

		it('reports warning for low timeout values', () => {
			const config = { ...validConfig, cliTimeout: 500 };
			const result = validateConfig(config);

			expect(result.warnings).toContain('CLI timeout (500ms) is very low, may cause issues');
		});

		it('reports warning for low clone timeout', () => {
			const config = { ...validConfig, cloneTimeout: 5000 };
			const result = validateConfig(config);

			expect(result.warnings).toContain('Clone timeout (5000ms) is very low for clone operations');
		});

		it('reports warning for low polling interval', () => {
			const config = { ...validConfig, pollCritical: 500 };
			const result = validateConfig(config);

			expect(result.warnings).toContain('Critical polling interval (500ms) is very low, may cause high load');
		});

		it('reports warning for conflicting feature flags', () => {
			const config = { ...validConfig, enableWrites: true, demoMode: true };
			const result = validateConfig(config);

			expect(result.warnings).toContain(
				'Both enableWrites and demoMode are true - writes will still be disabled in demo mode'
			);
		});
	});

	describe('loadConfigStrict', () => {
		it('throws on validation errors', () => {
			process.env.GASTOWN_TOWN_ROOT = '';
			process.env.GASTOWN_BD_CWD = '';

			expect(() => loadConfigStrict()).toThrow('Configuration validation failed');
		});

		it('returns config when valid', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config = loadConfigStrict();

			expect(config.townRoot).toBe('/valid/town/root');
		});
	});

	describe('getConfig singleton', () => {
		it('returns same instance on multiple calls', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config1 = getConfig();
			const config2 = getConfig();

			expect(config1).toBe(config2);
		});

		it('resets singleton with resetConfig', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config1 = getConfig();
			resetConfig();

			process.env.GASTOWN_TOWN_ROOT = '/different/path';
			const config2 = getConfig();

			expect(config1).not.toBe(config2);
			expect(config2.townRoot).toBe('/different/path');
		});
	});

	describe('getConfigStrict singleton', () => {
		it('throws on first call if invalid', () => {
			process.env.GASTOWN_TOWN_ROOT = '';
			process.env.GASTOWN_BD_CWD = '';

			expect(() => getConfigStrict()).toThrow('Configuration validation failed');
		});

		it('returns validated config when valid', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';

			const config = getConfigStrict();

			expect(config.townRoot).toBe('/valid/town/root');
		});
	});

	describe('checkBinaries', () => {
		it('returns true for available binaries', () => {
			const result = checkBinaries();

			expect(result.gt).toBe(true);
			expect(result.bd).toBe(true);
		});

		it('uses custom binary paths when provided', () => {
			const result = checkBinaries({ gtBin: 'custom-gt', bdBin: 'custom-bd' });

			expect(result).toBeDefined();
		});
	});

	describe('formatConfigForLogging', () => {
		it('formats config without exposing sensitive paths', () => {
			const config: GastownConfig = {
				townRoot: '/secret/path/town',
				gastownHome: '/secret/path/home',
				bdCwd: '/secret/path/bd',
				gtBin: 'gt',
				bdBin: 'bd',
				rigName: 'default',
				cliTimeout: 30_000,
				cloneTimeout: 180_000,
				pollCritical: 5_000,
				pollStandard: 15_000,
				pollBackground: 60_000,
				cacheTTL: 2_000,
				enableWrites: false,
				demoMode: true,
				cliEnv: {}
			};

			const formatted = formatConfigForLogging(config);

			expect(formatted.townRootSet).toBe(true);
			expect(formatted.gastownHomeSet).toBe(true);
			expect(formatted.bdCwdSet).toBe(true);
			expect((formatted as Record<string, unknown>)['townRoot']).toBeUndefined();
			expect((formatted as Record<string, unknown>)['gastownHome']).toBeUndefined();
			expect((formatted as Record<string, unknown>)['bdCwd']).toBeUndefined();
			expect(formatted.gtBin).toBe('gt');
			expect(formatted.enableWrites).toBe(false);
			expect(formatted.demoMode).toBe(true);
		});

		it('shows path booleans correctly for missing paths', () => {
			const config: GastownConfig = {
				townRoot: '',
				gastownHome: '',
				bdCwd: '',
				gtBin: 'gt',
				bdBin: 'bd',
				cliTimeout: 30_000,
				cloneTimeout: 180_000,
				pollCritical: 5_000,
				pollStandard: 15_000,
				pollBackground: 60_000,
				cacheTTL: 2_000,
				enableWrites: false,
				demoMode: true,
				cliEnv: {},
				rigName: 'default'
			};

			const formatted = formatConfigForLogging(config);

			expect(formatted.townRootSet).toBe(false);
			expect(formatted.gastownHomeSet).toBe(false);
			expect(formatted.bdCwdSet).toBe(false);
		});
	});

	describe('Rig Name Configuration', () => {
		it('has default rig name', () => {
			expect(DEFAULT_CONFIG.rigName).toBe('default');
		});

		it('loads rig name from GASTOWN_RIG environment variable', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';
			process.env.GASTOWN_RIG = 'my-custom-rig';

			const config = loadConfig();

			expect(config.rigName).toBe('my-custom-rig');
		});

		it('uses default when GASTOWN_RIG is not set', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';
			delete process.env.GASTOWN_RIG;

			const config = loadConfig();

			expect(config.rigName).toBe('default');
		});

		it('trims whitespace from rig name', () => {
			process.env.GASTOWN_RIG = '  my-rig  ';

			const config = loadConfig();

			expect(config.rigName).toBe('my-rig');
		});

		it('uses default for empty string rig name', () => {
			process.env.GASTOWN_RIG = '';

			const config = loadConfig();

			expect(config.rigName).toBe('default');
		});

		it('getCurrentRig returns current rig name', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';
			process.env.GASTOWN_RIG = 'test-rig';

			const rigName = getCurrentRig();

			expect(rigName).toBe('test-rig');
		});

		it('getRigConfig returns rig configuration object', () => {
			process.env.GASTOWN_TOWN_ROOT = '/valid/town/root';
			process.env.GASTOWN_BD_CWD = '/valid/bd/cwd';
			process.env.GASTOWN_RIG = 'my-rig';

			const rigConfig = getRigConfig();

			expect(rigConfig.name).toBe('my-rig');
			expect(rigConfig.prefix).toBe('bd');
		});
	});
});
