/**
 * Agent Detail API Endpoint
 *
 * Returns individual agent details by ID/address.
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
}

interface GtStatus {
	agents?: GtAgent[];
	rigs?: GtRig[];
}

interface AgentDetail {
	id: string;
	name: string;
	type: string;
	status: 'running' | 'idle' | 'offline' | 'stalled';
	rig: string | null;
	hasWork: boolean;
	unreadMail: number;
	session?: string;
	address: string;
	currentTask: string | null;
	lastSeen: string;
}

function mapAgentStatus(agent: GtAgent): AgentDetail['status'] {
	if (!agent.running) return 'offline';
	if (agent.has_work || agent.state === 'working') return 'running';
	return 'idle';
}

function findAgent(status: GtStatus, id: string): { agent: GtAgent; rig: string | null } | null {
	if (status.agents) {
		for (const agent of status.agents) {
			if (agent.name === id || agent.address === id) {
				return { agent, rig: null };
			}
		}
	}

	if (status.rigs) {
		for (const rig of status.rigs) {
			if (rig.agents) {
				for (const agent of rig.agents) {
					if (agent.name === id || agent.address === id || `${rig.name}/${agent.name}` === id) {
						return { agent, rig: rig.name };
					}
				}
			}
		}
	}

	return null;
}

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;
	const requestId = randomUUID();

	if (!id || !/^[a-zA-Z0-9/_-]+$/.test(id)) {
		return json({ error: 'Invalid agent ID format', requestId }, { status: 400 });
	}

	const supervisor = getProcessSupervisor();
	const result = await supervisor.gt<GtStatus>(['status', '--json'], { timeout: 15_000 });

	if (!result.success) {
		console.error(`Failed to fetch agent ${id}:`, result.error);
		return json(
			{
				error: result.error || 'Failed to fetch agent',
				requestId
			},
			{ status: 500 }
		);
	}

	const status = result.data;
	if (!status) {
		return json({ error: 'No status data returned', requestId }, { status: 500 });
	}

	const found = findAgent(status, id);

	if (!found) {
		return json({ error: 'Agent not found', requestId }, { status: 404 });
	}

	const { agent, rig } = found;

	const detail: AgentDetail = {
		id: agent.address || agent.name,
		name: agent.name,
		type: agent.role,
		status: mapAgentStatus(agent),
		rig,
		hasWork: agent.has_work,
		unreadMail: agent.unread_mail || 0,
		session: agent.session,
		address: agent.address,
		currentTask: agent.first_subject || null,
		lastSeen: new Date().toISOString()
	};

	return json({
		agent: detail,
		fetchedAt: new Date().toISOString(),
		requestId
	});
};
