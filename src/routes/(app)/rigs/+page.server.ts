import { spawn } from 'node:child_process';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { execGt, getTownCwd } from '$lib/server/gt';

/**
 * Execute CLI command safely using spawn (no shell injection risk)
 * Returns a promise that resolves with stdout or rejects with error
 */
function spawnAsync(
	command: string,
	args: string[],
	options: { timeout?: number } = {}
): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd: getTownCwd(),
			timeout: options.timeout,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		proc.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(stderr || `Command failed with code ${code}`));
			}
		});

		proc.on('error', (err) => {
			reject(err);
		});
	});
}

interface GtHook {
	agent: string;
	role: string;
	has_work: boolean;
	bead_id?: string;
}

interface GtAgent {
	name: string;
	address: string;
	session?: string;
	role: string;
	running: boolean;
	has_work: boolean;
	state?: string;
	unread_mail?: number;
}

interface GtRig {
	name: string;
	polecats: string[];
	polecat_count: number;
	crews: string[] | null;
	crew_count: number;
	has_witness: boolean;
	has_refinery: boolean;
	hooks: GtHook[];
	agents: GtAgent[];
}

interface GtStatus {
	name: string;
	location: string;
	rigs: GtRig[];
}

export interface Rig {
	name: string;
	polecatCount: number;
	crewCount: number;
	hasWitness: boolean;
	hasRefinery: boolean;
	polecats: string[];
	crews: string[];
	agents: string[];
}

function transformRig(rig: GtRig): Rig {
	const agents: string[] = [];
	if (rig.has_witness) agents.push('witness');
	if (rig.has_refinery) agents.push('refinery');

	return {
		name: rig.name,
		polecatCount: rig.polecat_count,
		crewCount: rig.crew_count,
		hasWitness: rig.has_witness,
		hasRefinery: rig.has_refinery,
		polecats: rig.polecats || [],
		crews: rig.crews || [],
		agents
	};
}

export const load: PageServerLoad = async () => {
	try {
		const { stdout } = await execGt('gt status --json');
		const data: GtStatus = JSON.parse(stdout);

		const rigs: Rig[] = data.rigs.map(transformRig);

		return { rigs, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch rig status';
		return { rigs: [], error: message };
	}
};

export const actions: Actions = {
	addRig: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const gitUrl = data.get('gitUrl');
		const prefix = data.get('prefix');

		if (!name || typeof name !== 'string') {
			return fail(400, { error: 'Rig name is required' });
		}

		if (!gitUrl || typeof gitUrl !== 'string') {
			return fail(400, { error: 'Git URL is required' });
		}

		try {
			// Use spawn with argument array to avoid shell injection
			const args = ['rig', 'add', name, gitUrl];
			if (prefix && typeof prefix === 'string' && prefix.trim()) {
				args.push('--prefix', prefix.trim());
			}
			await spawnAsync('gt', args, { timeout: 30000 });
			return { success: true, message: `Rig "${name}" added successfully` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to add rig';
			return fail(500, { error: message });
		}
	},

	removeRig: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');

		if (!name || typeof name !== 'string') {
			return fail(400, { error: 'Rig name is required' });
		}

		try {
			// Use spawn with argument array to avoid shell injection
			await spawnAsync('gt', ['rig', 'remove', name], { timeout: 10000 });
			return { success: true, message: `Rig "${name}" removed from registry` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to remove rig';
			return fail(500, { error: message });
		}
	}
};
