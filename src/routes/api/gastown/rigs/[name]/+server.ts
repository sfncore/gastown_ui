/**
 * Rig Detail API Endpoint
 *
 * Retrieves individual rig details by name.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';

interface RigAgent {
	name: string;
	type: string;
	status: string;
	branch?: string;
	lastActivity?: string;
}

interface RigDetail {
	name: string;
	path: string;
	status: 'active' | 'parked' | 'error' | 'unknown';
	agents: RigAgent[];
	branches: string[];
	defaultBranch: string;
	remote?: string;
	lastActivity?: string;
}

interface GtRigInfo {
	name: string;
	path: string;
	default_branch?: string;
	remote?: string;
	agents?: Array<{
		name: string;
		type: string;
		status?: string;
		branch?: string;
	}>;
	branches?: string[];
}

function determineStatus(rig: GtRigInfo): RigDetail['status'] {
	if (!rig.agents || rig.agents.length === 0) return 'parked';
	const hasActive = rig.agents.some(
		(a) => a.status === 'active' || a.status === 'running' || a.status === 'online'
	);
	return hasActive ? 'active' : 'parked';
}

export const GET: RequestHandler = async ({ params }) => {
	const { name } = params;

	if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
		return json({ error: 'Invalid rig name' }, { status: 400 });
	}

	try {
		const supervisor = getProcessSupervisor();
		const result = await supervisor.gt<GtRigInfo>(['rig', 'show', name, '--json'], {
			timeout: 10_000
		});

		if (!result.success) {
			const errorMessage = result.error || 'Unknown error';
			if (
				errorMessage.includes('not found') ||
				errorMessage.includes('no rig') ||
				errorMessage.includes('unknown rig')
			) {
				return json({ error: 'Rig not found' }, { status: 404 });
			}
			console.error(`Failed to fetch rig ${name}:`, errorMessage);
			return json(
				{
					error: 'Failed to fetch rig',
					details: errorMessage
				},
				{ status: 500 }
			);
		}

		const rigInfo = result.data as GtRigInfo;

		const rig: RigDetail = {
			name: rigInfo.name,
			path: rigInfo.path,
			status: determineStatus(rigInfo),
			agents: (rigInfo.agents || []).map((a) => ({
				name: a.name,
				type: a.type,
				status: a.status || 'unknown',
				branch: a.branch
			})),
			branches: rigInfo.branches || [],
			defaultBranch: rigInfo.default_branch || 'main',
			remote: rigInfo.remote
		};

		return json({
			rig,
			fetchedAt: new Date().toISOString()
		});
	} catch (error) {
		console.error(`Unexpected error fetching rig ${name}:`, error);
		return json(
			{
				error: 'Failed to fetch rig',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
