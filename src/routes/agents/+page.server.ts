import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { PageServerLoad } from './$types';

const execAsync = promisify(exec);

type AgentStatus = 'running' | 'idle' | 'error' | 'complete';

interface Agent {
	id: string;
	name: string;
	task: string;
	status: AgentStatus;
	progress: number;
	meta: string;
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
	first_subject?: string;
}

interface GtHook {
	agent: string;
	role: string;
	has_work: boolean;
	bead_id?: string;
}

interface GtRig {
	name: string;
	polecats: string[];
	has_witness: boolean;
	has_refinery: boolean;
	hooks: GtHook[];
	agents: GtAgent[];
}

interface GtStatus {
	name: string;
	agents: GtAgent[];
	rigs: GtRig[];
}

function mapAgentStatus(agent: GtAgent): AgentStatus {
	if (agent.state === 'dead') return 'error';
	if (!agent.running) return 'idle';
	if (agent.has_work) return 'running';
	return 'idle';
}

function getAgentTask(agent: GtAgent, hook?: GtHook): string {
	if (hook?.bead_id) return `Working on ${hook.bead_id}`;
	if (agent.first_subject) return agent.first_subject;
	if (agent.has_work) return 'Processing work';
	if (!agent.running) return 'Not running';
	return 'Waiting for work';
}

function formatAgentName(agent: GtAgent): string {
	const roleNames: Record<string, string> = {
		coordinator: 'Mayor',
		'health-check': 'Deacon',
		witness: 'Witness',
		refinery: 'Refinery',
		polecat: agent.name.charAt(0).toUpperCase() + agent.name.slice(1)
	};
	return roleNames[agent.role] || agent.name;
}

function transformAgent(agent: GtAgent, hook?: GtHook): Agent {
	return {
		id: agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name,
		name: formatAgentName(agent),
		task: getAgentTask(agent, hook),
		status: mapAgentStatus(agent),
		progress: agent.has_work ? 50 : 0,
		meta: agent.address || agent.name
	};
}

export const load: PageServerLoad = async () => {
	try {
		const { stdout } = await execAsync('gt status --json');
		const data: GtStatus = JSON.parse(stdout);

		const agents: Agent[] = [];

		// Add top-level agents (mayor, deacon)
		for (const agent of data.agents) {
			agents.push(transformAgent(agent));
		}

		// Add rig agents (witness, refinery, polecats)
		for (const rig of data.rigs) {
			const hookMap = new Map(rig.hooks.map((h) => [h.agent, h]));

			for (const agent of rig.agents) {
				const hook = hookMap.get(agent.address);
				agents.push(transformAgent(agent, hook));
			}
		}

		return { agents, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch agent status';
		return { agents: [], error: message };
	}
};
