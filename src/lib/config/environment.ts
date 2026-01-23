/**
 * Environment Configuration Module
 *
 * Centralized environment configuration with validation on startup.
 * All environment variables are validated and typed for safe access.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Configuration interface for Gas Town UI
 */
export interface GastownConfig {
	// Core paths
	townRoot: string;       // GASTOWN_TOWN_ROOT
	gastownHome: string;    // GASTOWN_HOME (~/.gastown)
	bdCwd: string;          // GASTOWN_BD_CWD

	// CLI binaries
	gtBin: string;          // GASTOWN_GT_BIN (default: 'gt')
	bdBin: string;          // GASTOWN_BD_BIN (default: 'bd')

	// Rig configuration
	rigName: string;        // GASTOWN_RIG (default: 'default')

	// Timeouts (ms)
	cliTimeout: number;     // Default 30000
	cloneTimeout: number;   // Default 180000

	// Polling intervals (ms)
	pollCritical: number;   // Default 5000 (status, queue)
	pollStandard: number;   // Default 15000 (convoys, work)
	pollBackground: number; // Default 60000 (rigs, health)

	// Cache
	cacheTTL: number;       // Default 2000

	// Feature flags
	enableWrites: boolean;  // Default false
	demoMode: boolean;      // Default true

	// Computed
	cliEnv: Record<string, string>; // Env vars to pass to CLI
}

/**
 * Validation result from config validation
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<GastownConfig, 'townRoot' | 'gastownHome' | 'bdCwd' | 'cliEnv'> = {
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
	demoMode: true
};

/**
 * Check if a binary is available in PATH
 */
function which(binary: string): string | null {
	try {
		const result = execSync(`which ${binary}`, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe']
		}).trim();
		return result || null;
	} catch {
		return null;
	}
}

/**
 * Parse environment variables into typed config
 */
function parseEnv(): Partial<GastownConfig> {
	const env = typeof process !== 'undefined' ? process.env : {};

	const parseNumber = (value: string | undefined, defaultValue: number): number => {
		if (value === undefined) return defaultValue;
		const parsed = parseInt(value, 10);
		return isNaN(parsed) ? defaultValue : parsed;
	};

	const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
		if (value === undefined) return defaultValue;
		return value.toLowerCase() === 'true' || value === '1';
	};

	// Parse rig name with trimming and default handling
	const parseRigName = (value: string | undefined): string => {
		if (!value) return DEFAULT_CONFIG.rigName;
		const trimmed = value.trim();
		return trimmed || DEFAULT_CONFIG.rigName;
	};

	return {
		townRoot: env.GASTOWN_TOWN_ROOT,
		gastownHome: env.GASTOWN_HOME || join(env.HOME || '~', '.gastown'),
		bdCwd: env.GASTOWN_BD_CWD,
		gtBin: env.GASTOWN_GT_BIN || DEFAULT_CONFIG.gtBin,
		bdBin: env.GASTOWN_BD_BIN || DEFAULT_CONFIG.bdBin,
		rigName: parseRigName(env.GASTOWN_RIG),
		cliTimeout: parseNumber(env.GASTOWN_CLI_TIMEOUT, DEFAULT_CONFIG.cliTimeout),
		cloneTimeout: parseNumber(env.GASTOWN_CLONE_TIMEOUT, DEFAULT_CONFIG.cloneTimeout),
		pollCritical: parseNumber(env.GASTOWN_POLL_CRITICAL, DEFAULT_CONFIG.pollCritical),
		pollStandard: parseNumber(env.GASTOWN_POLL_STANDARD, DEFAULT_CONFIG.pollStandard),
		pollBackground: parseNumber(env.GASTOWN_POLL_BACKGROUND, DEFAULT_CONFIG.pollBackground),
		cacheTTL: parseNumber(env.GASTOWN_CACHE_TTL, DEFAULT_CONFIG.cacheTTL),
		enableWrites: parseBoolean(env.GASTOWN_ENABLE_WRITES, DEFAULT_CONFIG.enableWrites),
		demoMode: parseBoolean(env.GASTOWN_DEMO_MODE, DEFAULT_CONFIG.demoMode)
	};
}

/**
 * Build CLI environment variables
 */
function buildCliEnv(config: Partial<GastownConfig>): Record<string, string> {
	const cliEnv: Record<string, string> = {};

	if (config.townRoot) {
		cliEnv.GASTOWN_TOWN_ROOT = config.townRoot;
	}
	if (config.gastownHome) {
		cliEnv.GASTOWN_HOME = config.gastownHome;
	}
	if (config.bdCwd) {
		cliEnv.GASTOWN_BD_CWD = config.bdCwd;
	}

	return cliEnv;
}

/**
 * Validate configuration
 */
export function validateConfig(config: GastownConfig): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required binaries
	const gtPath = which(config.gtBin);
	if (!gtPath) {
		errors.push(`gt binary not found: ${config.gtBin}`);
	}

	const bdPath = which(config.bdBin);
	if (!bdPath) {
		errors.push(`bd binary not found: ${config.bdBin}`);
	}

	// Check paths
	if (!config.townRoot) {
		errors.push('Town root not configured: GASTOWN_TOWN_ROOT is required');
	} else if (!existsSync(config.townRoot)) {
		errors.push(`Town root not found: ${config.townRoot}`);
	}

	if (!config.bdCwd) {
		errors.push('Beads working directory not configured: GASTOWN_BD_CWD is required');
	} else if (!existsSync(join(config.bdCwd, '.beads'))) {
		errors.push(`Beads directory not found: ${config.bdCwd}/.beads`);
	}

	// Validate gastownHome
	if (!config.gastownHome) {
		warnings.push('GASTOWN_HOME not set, using default ~/.gastown');
	}

	// Validate timeout values
	if (config.cliTimeout < 1000) {
		warnings.push(`CLI timeout (${config.cliTimeout}ms) is very low, may cause issues`);
	}
	if (config.cloneTimeout < 10000) {
		warnings.push(`Clone timeout (${config.cloneTimeout}ms) is very low for clone operations`);
	}

	// Validate polling intervals
	if (config.pollCritical < 1000) {
		warnings.push(`Critical polling interval (${config.pollCritical}ms) is very low, may cause high load`);
	}

	// Feature flag warnings
	if (config.enableWrites && config.demoMode) {
		warnings.push('Both enableWrites and demoMode are true - writes will still be disabled in demo mode');
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): GastownConfig {
	const parsedEnv = parseEnv();
	const cliEnv = buildCliEnv(parsedEnv);

	return {
		townRoot: parsedEnv.townRoot || '',
		gastownHome: parsedEnv.gastownHome || join(process.env.HOME || '~', '.gastown'),
		bdCwd: parsedEnv.bdCwd || '',
		gtBin: parsedEnv.gtBin || DEFAULT_CONFIG.gtBin,
		bdBin: parsedEnv.bdBin || DEFAULT_CONFIG.bdBin,
		rigName: parsedEnv.rigName || DEFAULT_CONFIG.rigName,
		cliTimeout: parsedEnv.cliTimeout || DEFAULT_CONFIG.cliTimeout,
		cloneTimeout: parsedEnv.cloneTimeout || DEFAULT_CONFIG.cloneTimeout,
		pollCritical: parsedEnv.pollCritical || DEFAULT_CONFIG.pollCritical,
		pollStandard: parsedEnv.pollStandard || DEFAULT_CONFIG.pollStandard,
		pollBackground: parsedEnv.pollBackground || DEFAULT_CONFIG.pollBackground,
		cacheTTL: parsedEnv.cacheTTL || DEFAULT_CONFIG.cacheTTL,
		enableWrites: parsedEnv.enableWrites ?? DEFAULT_CONFIG.enableWrites,
		demoMode: parsedEnv.demoMode ?? DEFAULT_CONFIG.demoMode,
		cliEnv
	};
}

/**
 * Load config with validation, throwing on errors
 */
export function loadConfigStrict(): GastownConfig {
	const config = loadConfig();
	const result = validateConfig(config);

	if (!result.valid) {
		const errorMessage = [
			'Configuration validation failed:',
			...result.errors.map((e) => `  - ${e}`)
		].join('\n');
		throw new Error(errorMessage);
	}

	if (result.warnings.length > 0) {
		console.warn('Configuration warnings:');
		result.warnings.forEach((w) => console.warn(`  - ${w}`));
	}

	return config;
}

// Singleton config instance
let _config: GastownConfig | null = null;

/**
 * Get the current configuration (lazy-loaded singleton)
 */
export function getConfig(): GastownConfig {
	if (!_config) {
		_config = loadConfig();
	}
	return _config;
}

/**
 * Get validated configuration (lazy-loaded singleton with strict validation)
 */
export function getConfigStrict(): GastownConfig {
	if (!_config) {
		_config = loadConfigStrict();
	}
	return _config;
}

/**
 * Reset the config singleton (useful for testing)
 */
export function resetConfig(): void {
	_config = null;
}

/**
 * Check if binaries are available
 */
export function checkBinaries(config?: Partial<GastownConfig>): { gt: boolean; bd: boolean } {
	const gtBin = config?.gtBin || DEFAULT_CONFIG.gtBin;
	const bdBin = config?.bdBin || DEFAULT_CONFIG.bdBin;

	return {
		gt: which(gtBin) !== null,
		bd: which(bdBin) !== null
	};
}

/**
 * Format config for logging (redacts sensitive paths)
 */
export function formatConfigForLogging(config: GastownConfig): Record<string, unknown> {
	return {
		gtBin: config.gtBin,
		bdBin: config.bdBin,
		rigName: config.rigName,
		townRootSet: !!config.townRoot,
		gastownHomeSet: !!config.gastownHome,
		bdCwdSet: !!config.bdCwd,
		timeouts: {
			cli: config.cliTimeout,
			clone: config.cloneTimeout
		},
		polling: {
			critical: config.pollCritical,
			standard: config.pollStandard,
			background: config.pollBackground
		},
		cacheTTL: config.cacheTTL,
		enableWrites: config.enableWrites,
		demoMode: config.demoMode
	};
}

/**
 * Get the current rig name from configuration
 * Convenience function for use throughout the codebase
 */
export function getCurrentRig(): string {
	return getConfig().rigName;
}

/**
 * Get rig configuration for CLI commands
 * Returns rig name and optional prefix settings
 */
export interface RigConfig {
	name: string;
	prefix: string;
}

export function getRigConfig(): RigConfig {
	const config = getConfig();
	return {
		name: config.rigName,
		prefix: 'bd' // Default prefix, can be made configurable later
	};
}
