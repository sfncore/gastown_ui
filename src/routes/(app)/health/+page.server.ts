import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { PageServerLoad } from './$types';

const execAsync = promisify(exec);

type HealthStatus = 'healthy' | 'degraded' | 'offline';

interface DaemonHealth {
	name: string;
	role: string;
	running: boolean;
	hasWork: boolean;
	status: HealthStatus;
}

interface RigHealth {
	name: string;
	status: HealthStatus;
	polecatCount: number;
	activePolecats: number;
	hasWitness: boolean;
	witnessStatus: HealthStatus;
	hasRefinery: boolean;
	refineryStatus: HealthStatus;
	deadAgents: string[];
}

interface HealthData {
	timestamp: string;
	overallStatus: HealthStatus;
	isDegraded: boolean;
	daemons: DaemonHealth[];
	deaconPatrolStatus: 'active' | 'inactive' | 'unknown';
	bootTriageStatus: 'complete' | 'pending' | 'unknown';
	rigs: RigHealth[];
	summary: {
		totalRigs: number;
		totalPolecats: number;
		activeHooks: number;
		healthyRigs: number;
		degradedRigs: number;
		offlineRigs: number;
	};
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

interface GtHook {
	agent: string;
	role: string;
	has_work: boolean;
}

interface GtRig {
	name: string;
	polecats: string[];
	polecat_count: number;
	has_witness: boolean;
	has_refinery: boolean;
	hooks: GtHook[];
	agents: GtAgent[];
}

interface GtStatus {
	name: string;
	agents: GtAgent[];
	rigs: GtRig[];
	summary: {
		rig_count: number;
		polecat_count: number;
		active_hooks: number;
	};
}

function getAgentHealthStatus(agent: GtAgent): HealthStatus {
	if (agent.state === 'dead') return 'offline';
	if (!agent.running) return 'offline';
	return 'healthy';
}

function getRigHealthStatus(rig: GtRig): HealthStatus {
	const deadAgents = rig.agents.filter((a) => a.state === 'dead');
	const notRunning = rig.agents.filter((a) => !a.running);

	if (deadAgents.length > 0 || notRunning.length === rig.agents.length) {
		return 'offline';
	}
	if (notRunning.length > 0) {
		return 'degraded';
	}
	return 'healthy';
}

function getOverallStatus(daemons: DaemonHealth[], rigs: RigHealth[]): HealthStatus {
	const allOffline =
		daemons.every((d) => d.status === 'offline') && rigs.every((r) => r.status === 'offline');
	if (allOffline) return 'offline';

	const hasDegraded =
		daemons.some((d) => d.status !== 'healthy') || rigs.some((r) => r.status !== 'healthy');
	if (hasDegraded) return 'degraded';

	return 'healthy';
}

export const load: PageServerLoad = async () => {
	try {
		const { stdout } = await execAsync('gt status --json');
		const data: GtStatus = JSON.parse(stdout);

		// Process daemons (top-level agents: mayor, deacon)
		const daemons: DaemonHealth[] = data.agents.map((agent) => ({
			name: agent.name.charAt(0).toUpperCase() + agent.name.slice(1),
			role: agent.role,
			running: agent.running,
			hasWork: agent.has_work,
			status: getAgentHealthStatus(agent)
		}));

		// Get deacon status specifically
		const deacon = data.agents.find((a) => a.role === 'health-check');
		const deaconPatrolStatus: 'active' | 'inactive' | 'unknown' = deacon
			? deacon.running
				? 'active'
				: 'inactive'
			: 'unknown';

		// Boot triage - check if mayor is running and system initialized
		const mayor = data.agents.find((a) => a.role === 'coordinator');
		const bootTriageStatus: 'complete' | 'pending' | 'unknown' = mayor
			? mayor.running
				? 'complete'
				: 'pending'
			: 'unknown';

		// Process rigs
		const rigs: RigHealth[] = data.rigs.map((rig) => {
			const witness = rig.agents.find((a) => a.role === 'witness');
			const refinery = rig.agents.find((a) => a.role === 'refinery');
			const polecats = rig.agents.filter((a) => a.role === 'polecat');
			const activePolecats = polecats.filter((p) => p.running && p.has_work).length;
			const deadAgents = rig.agents.filter((a) => a.state === 'dead').map((a) => a.name);

			return {
				name: rig.name,
				status: getRigHealthStatus(rig),
				polecatCount: rig.polecat_count,
				activePolecats,
				hasWitness: rig.has_witness,
				witnessStatus: witness ? getAgentHealthStatus(witness) : 'offline',
				hasRefinery: rig.has_refinery,
				refineryStatus: refinery ? getAgentHealthStatus(refinery) : 'offline',
				deadAgents
			};
		});

		const overallStatus = getOverallStatus(daemons, rigs);
		const healthyRigs = rigs.filter((r) => r.status === 'healthy').length;
		const degradedRigs = rigs.filter((r) => r.status === 'degraded').length;
		const offlineRigs = rigs.filter((r) => r.status === 'offline').length;

		const healthData: HealthData = {
			timestamp: new Date().toISOString(),
			overallStatus,
			isDegraded: overallStatus !== 'healthy',
			daemons,
			deaconPatrolStatus,
			bootTriageStatus,
			rigs,
			summary: {
				totalRigs: data.summary.rig_count,
				totalPolecats: data.summary.polecat_count,
				activeHooks: data.summary.active_hooks,
				healthyRigs,
				degradedRigs,
				offlineRigs
			}
		};

		return { health: healthData, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch health status';
		return {
			health: null,
			error: message
		};
	}
};
