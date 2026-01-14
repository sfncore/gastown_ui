/**
 * Capabilities API Endpoint
 *
 * Returns CLI capabilities and version information.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface Capabilities {
	gtVersion: string;
	bdVersion: string;
	features: {
		jsonOutput: boolean;
		mailInbox: boolean;
		sseTailing: boolean;
		convoys: boolean;
		formulas: boolean;
		mergeQueue: boolean;
		workflows: boolean;
	};
	paths: {
		workspace: string | null;
		beadsDb: string | null;
		eventsFile: string | null;
	};
	timestamp: string;
}

let cachedCapabilities: Capabilities | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getVersion(cmd: string): Promise<string> {
	try {
		const { stdout } = await execAsync(`${cmd} --version`, { timeout: 5_000 });
		const match = stdout.match(/version\s+(\S+)/i);
		return match ? match[1] : stdout.trim().split(/\s+/).pop() || 'unknown';
	} catch {
		return 'unavailable';
	}
}

async function checkFeature(cmd: string): Promise<boolean> {
	try {
		await execAsync(cmd, { timeout: 5_000 });
		return true;
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		return !msg.includes('unknown command') && !msg.includes('not found');
	}
}

async function getWorkspacePath(): Promise<string | null> {
	try {
		const { stdout } = await execAsync('gt status --json', { timeout: 10_000 });
		const status = JSON.parse(stdout);
		return status.location || null;
	} catch {
		return null;
	}
}

async function probeCapabilities(): Promise<Capabilities> {
	const [gtVersion, bdVersion, workspace] = await Promise.all([
		getVersion('gt'),
		getVersion('bd'),
		getWorkspacePath()
	]);

	const [mailInbox, convoys, formulas, mergeQueue, workflows] = await Promise.all([
		checkFeature('gt mail inbox --help'),
		checkFeature('bd list --type=convoy --help'),
		checkFeature('gt formula list --help'),
		checkFeature('gt mq list --help'),
		checkFeature('gt workflow list --help')
	]);

	return {
		gtVersion,
		bdVersion,
		features: {
			jsonOutput: true,
			mailInbox,
			sseTailing: true,
			convoys,
			formulas,
			mergeQueue,
			workflows
		},
		paths: {
			workspace,
			beadsDb: workspace ? `${workspace}/.beads` : null,
			eventsFile: workspace ? `${workspace}/.beads/.events.jsonl` : null
		},
		timestamp: new Date().toISOString()
	};
}

export const GET: RequestHandler = async () => {
	const now = Date.now();

	if (cachedCapabilities && now - cacheTimestamp < CACHE_TTL_MS) {
		return json(cachedCapabilities);
	}

	try {
		const capabilities = await probeCapabilities();

		cachedCapabilities = capabilities;
		cacheTimestamp = now;

		return json(capabilities);
	} catch (error) {
		console.error('Failed to probe capabilities:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to probe capabilities',
				gtVersion: 'unknown',
				bdVersion: 'unknown',
				features: {
					jsonOutput: false,
					mailInbox: false,
					sseTailing: false,
					convoys: false,
					formulas: false,
					mergeQueue: false,
					workflows: false
				},
				paths: {
					workspace: null,
					beadsDb: null,
					eventsFile: null
				},
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
