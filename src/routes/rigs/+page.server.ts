import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

const execAsync = promisify(exec);

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
		const { stdout } = await execAsync('gt status --json');
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
			let cmd = `gt rig add "${name}" "${gitUrl}"`;
			if (prefix && typeof prefix === 'string' && prefix.trim()) {
				cmd += ` --prefix "${prefix.trim()}"`;
			}
			await execAsync(cmd);
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
			await execAsync(`gt rig remove "${name}"`);
			return { success: true, message: `Rig "${name}" removed from registry` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to remove rig';
			return fail(500, { error: message });
		}
	}
};
