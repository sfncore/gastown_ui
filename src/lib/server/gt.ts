/**
 * Server-side utilities for executing gt (gastown) CLI commands
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '$env/dynamic/private';

const execAsync = promisify(exec);

/**
 * Get the town directory from GT_TOWN environment variable.
 * Falls back to undefined (current directory) if not set.
 */
export function getTownCwd(): string | undefined {
	return env.GT_TOWN || undefined;
}

/**
 * Build the PATH environment variable that includes gt and bd CLI locations.
 * Prepends common install locations to ensure CLIs are found.
 */
function getEnvWithPath(): NodeJS.ProcessEnv {
	const homedir = process.env.HOME || '';
	const additionalPaths = [
		`${homedir}/.local/bin`, // bd default install location
		`${homedir}/go/bin` // gt default install location (go install)
	];
	const currentPath = process.env.PATH || '';
	const newPath = [...additionalPaths, currentPath].join(':');

	return {
		...process.env,
		PATH: newPath
	};
}

/**
 * Execute a gt command in the configured town directory.
 * Ensures PATH includes common CLI install locations (~/go/bin, ~/.local/bin).
 * @param command - The gt command to run (e.g., 'gt status --json')
 * @param options - Additional exec options
 */
export async function execGt(
	command: string,
	options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
	const cwd = getTownCwd();
	const execEnv = getEnvWithPath();
	return execAsync(command, { cwd, env: execEnv, ...options });
}
