/**
 * Agents API Endpoint
 *
 * Returns agent list with their current status.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

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

interface GtRig {
	name: string;
	agents?: GtAgent[];
	polecats?: string[];
	has_witness: boolean;
	has_refinery: boolean;
}

interface GtStatus {
	name: string;
	agents?: GtAgent[];
	rigs?: GtRig[];
}

interface AgentResponse {
	name: string;
	type: string;
	status: 'running' | 'idle' | 'offline';
	rig: string | null;
	hasWork: boolean;
	unreadMail: number;
	session?: string;
	address: string;
}

function mapAgentStatus(agent: GtAgent): 'running' | 'idle' | 'offline' {
	if (!agent.running) return 'offline';
	if (agent.has_work || agent.state === 'working') return 'running';
	return 'idle';
}

function extractAgents(status: GtStatus): AgentResponse[] {
	const agents: AgentResponse[] = [];

	if (status.agents) {
		for (const agent of status.agents) {
			agents.push({
				name: agent.name,
				type: agent.role,
				status: mapAgentStatus(agent),
				rig: null,
				hasWork: agent.has_work,
				unreadMail: agent.unread_mail || 0,
				session: agent.session,
				address: agent.address
			});
		}
	}

	if (status.rigs) {
		for (const rig of status.rigs) {
			if (rig.agents) {
				for (const agent of rig.agents) {
					agents.push({
						name: agent.name,
						type: agent.role,
						status: mapAgentStatus(agent),
						rig: rig.name,
						hasWork: agent.has_work,
						unreadMail: agent.unread_mail || 0,
						session: agent.session,
						address: agent.address
					});
				}
			}
		}
	}

	return agents;
}

let cachedResponse: { agents: AgentResponse[]; timestamp: string; requestId: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10_000;

export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const now = Date.now();

	if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
		return json({ ...cachedResponse, requestId });
	}

	const supervisor = getProcessSupervisor();

	try {
		const result = await supervisor.gt<GtStatus>(['status', '--json'], { timeout: 15_000 });

		if (!result.success) {
			console.error('Failed to fetch agents:', result.error);
			return json(
				{
					error: result.error || 'Failed to fetch agents',
					agents: [],
					timestamp: new Date().toISOString(),
					requestId
				},
				{ status: 500 }
			);
		}

		const agents = extractAgents(result.data!);

		const response = {
			agents,
			timestamp: new Date().toISOString(),
			requestId
		};

		cachedResponse = response;
		cacheTimestamp = now;

		return json(response);
	} catch (error) {
		console.error('Failed to fetch agents:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch agents',
				agents: [],
				timestamp: new Date().toISOString(),
				requestId
			},
			{ status: 500 }
		);
	}
};
