import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

const execAsync = promisify(exec);

type CrewStatus = 'running' | 'idle' | 'stopped' | 'error';

interface GtCrewMember {
	name: string;
	rig: string;
	branch: string;
	session: string | null;
	running: boolean;
	has_work: boolean;
	git_status: {
		clean: boolean;
		staged: number;
		modified: number;
		untracked: number;
	};
	last_activity?: string;
	current_work?: string;
}

interface GtCrewList {
	rig: string;
	crew: GtCrewMember[];
}

export interface CrewMember {
	name: string;
	rig: string;
	branch: string;
	status: CrewStatus;
	session: string | null;
	gitStatus: {
		clean: boolean;
		staged: number;
		modified: number;
		untracked: number;
	};
	lastActivity: string;
	currentWork: string;
}

interface GtRig {
	name: string;
	crews: string[] | null;
	crew_count: number;
}

interface GtStatus {
	rigs: GtRig[];
}

function mapCrewStatus(member: GtCrewMember): CrewStatus {
	if (!member.session) return 'stopped';
	if (!member.running) return 'idle';
	if (member.has_work) return 'running';
	return 'idle';
}

function transformCrewMember(member: GtCrewMember): CrewMember {
	return {
		name: member.name,
		rig: member.rig,
		branch: member.branch,
		status: mapCrewStatus(member),
		session: member.session,
		gitStatus: {
			clean: member.git_status?.clean ?? true,
			staged: member.git_status?.staged ?? 0,
			modified: member.git_status?.modified ?? 0,
			untracked: member.git_status?.untracked ?? 0
		},
		lastActivity: member.last_activity || 'Unknown',
		currentWork: member.current_work || 'No active work'
	};
}

export const load: PageServerLoad = async () => {
	try {
		// Get all rigs first
		const { stdout: statusStdout } = await execAsync('gt status --json');
		const statusData: GtStatus = JSON.parse(statusStdout);

		const allCrew: CrewMember[] = [];
		const rigNames: string[] = [];

		// Get crew for each rig
		for (const rig of statusData.rigs) {
			rigNames.push(rig.name);
			if (rig.crew_count > 0) {
				try {
					const { stdout: crewStdout } = await execAsync(`gt crew list --rig "${rig.name}" --json`);
					const crewData: GtCrewList = JSON.parse(crewStdout);
					for (const member of crewData.crew || []) {
						allCrew.push(transformCrewMember({ ...member, rig: rig.name }));
					}
				} catch {
					// Rig may not have crew command support, skip
				}
			}
		}

		return {
			crew: allCrew,
			rigs: rigNames,
			error: null
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch crew status';
		return { crew: [], rigs: [], error: message };
	}
};

export const actions: Actions = {
	addCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');

		if (!name || typeof name !== 'string') {
			return fail(400, { error: 'Crew name is required' });
		}

		if (!rig || typeof rig !== 'string') {
			return fail(400, { error: 'Rig is required' });
		}

		try {
			await execAsync(`gt crew add "${name}" --rig "${rig}"`);
			return { success: true, message: `Crew "${name}" created in ${rig}` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create crew';
			return fail(500, { error: message });
		}
	},

	startCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');

		if (!name || typeof name !== 'string' || !rig || typeof rig !== 'string') {
			return fail(400, { error: 'Name and rig are required' });
		}

		try {
			await execAsync(`gt crew start "${name}" --rig "${rig}"`);
			return { success: true, message: `Started session for ${name}` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to start crew session';
			return fail(500, { error: message });
		}
	},

	stopCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');

		if (!name || typeof name !== 'string' || !rig || typeof rig !== 'string') {
			return fail(400, { error: 'Name and rig are required' });
		}

		try {
			await execAsync(`gt crew stop "${name}" --rig "${rig}"`);
			return { success: true, message: `Stopped session for ${name}` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to stop crew session';
			return fail(500, { error: message });
		}
	},

	peekCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');

		if (!name || typeof name !== 'string' || !rig || typeof rig !== 'string') {
			return fail(400, { error: 'Name and rig are required' });
		}

		try {
			const { stdout } = await execAsync(`gt peek "${rig}/crew/${name}" --lines 50`);
			return { success: true, peek: stdout, peekTarget: `${rig}/crew/${name}` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to peek crew session';
			return fail(500, { error: message });
		}
	},

	nudgeCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');
		const message = data.get('message');

		if (!name || typeof name !== 'string' || !rig || typeof rig !== 'string') {
			return fail(400, { error: 'Name and rig are required' });
		}

		const nudgeMsg = typeof message === 'string' && message.trim() ? message.trim() : 'Nudge from UI';

		try {
			await execAsync(`gt nudge "${rig}/crew/${name}" -m "${nudgeMsg}"`);
			return { success: true, message: `Nudged ${name}` };
		} catch (err) {
			const errMessage = err instanceof Error ? err.message : 'Failed to nudge crew';
			return fail(500, { error: errMessage });
		}
	},

	removeCrew: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const rig = data.get('rig');

		if (!name || typeof name !== 'string' || !rig || typeof rig !== 'string') {
			return fail(400, { error: 'Name and rig are required' });
		}

		try {
			await execAsync(`gt crew remove "${name}" --rig "${rig}"`);
			return { success: true, message: `Removed crew "${name}" from ${rig}` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to remove crew';
			return fail(500, { error: message });
		}
	}
};
