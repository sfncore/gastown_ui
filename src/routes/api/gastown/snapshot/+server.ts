import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

interface RigSnapshot {
	name: string;
	status: 'active' | 'idle';
	polecats: number;
	has_witness: boolean;
	has_refinery: boolean;
	active_work: number;
}

interface PolecatSnapshot {
	id: string;
	name: string;
	role: string;
	rig: string;
	status: 'running' | 'idle';
	has_work: boolean;
	task?: string;
}

interface ConvoySnapshot {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_count?: number;
}

interface ActivitySnapshot {
	id: string;
	title: string;
	type: string;
	status: string;
	updated_at: string;
}

interface MailSummary {
	unread: number;
	total: number;
}

interface QueueSummary {
	pending: number;
	inProgress: number;
	total: number;
}

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface GasТownSnapshot {
	rigs: RigSnapshot[];
	polecats: PolecatSnapshot[];
	convoys: ConvoySnapshot[];
	recent_activity: ActivitySnapshot[];
	mail: MailSummary;
	queue: QueueSummary;
	health: HealthStatus;
	fetchedAt: string;
	timestamp: string;
	requestId: string;
}

let cachedSnapshot: GasТownSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;

interface GtStatusResponse {
	agents?: unknown[];
	rigs?: Array<{
		name: string;
		agents?: Array<{
			address: string;
			name: string;
			role: string;
			running: boolean;
			has_work: boolean;
			first_subject?: string;
		}>;
		polecats?: unknown[];
		hooks?: Array<{ agent: string; bead_id?: string }>;
		has_witness?: boolean;
		has_refinery?: boolean;
	}>;
	queue?: {
		pending?: number;
		in_progress?: number;
		total?: number;
	};
}

interface BdIssue {
	id: string;
	title: string;
	status: string;
	priority?: number;
	issue_type?: string;
	type?: string;
	updated_at?: string;
	issue_count?: number;
}

export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const now = Date.now();

	if (cachedSnapshot && now - cacheTimestamp < CACHE_TTL_MS) {
		return json({ ...cachedSnapshot, requestId });
	}

	const fetchedAt = new Date().toISOString();
	const supervisor = getProcessSupervisor();

	const [statusResult, convoysResult, activityResult, mailResult] = await Promise.all([
		supervisor.gt<GtStatusResponse>(['status', '--json'], { timeout: 5000 }),
		supervisor.bd<BdIssue[]>(['list', '--type=convoy', '--status=open', '--json'], {
			timeout: 5000
		}),
		supervisor.bd<BdIssue[]>(['list', '--status=in_progress,completed', '--json'], {
			timeout: 5000
		}),
		supervisor.bd<BdIssue[]>(['list', '--type=message', '--status=open', '--json'], {
			timeout: 5000
		})
	]);

	const gtStatus: GtStatusResponse = statusResult.success
		? (statusResult.data as GtStatusResponse)
		: { agents: [], rigs: [] };
	const convoysData: BdIssue[] = convoysResult.success
		? Array.isArray(convoysResult.data)
			? convoysResult.data
			: []
		: [];
	const activityData: BdIssue[] = activityResult.success
		? Array.isArray(activityResult.data)
			? activityResult.data
			: []
		: [];
	const mailData: BdIssue[] = mailResult.success
		? Array.isArray(mailResult.data)
			? mailResult.data
			: []
		: [];

	const rigs: RigSnapshot[] = (gtStatus.rigs || []).map((rig) => {
		const activePolecats = (rig.agents || []).filter(
			(a) => a.role === 'polecat' && a.running && a.has_work
		).length;

		return {
			name: rig.name,
			status: activePolecats > 0 ? 'active' : 'idle',
			polecats: (rig.polecats || []).length,
			has_witness: rig.has_witness || false,
			has_refinery: rig.has_refinery || false,
			active_work: activePolecats
		};
	});

	const polecats: PolecatSnapshot[] = [];
	for (const rig of gtStatus.rigs || []) {
		for (const agent of rig.agents || []) {
			if (agent.role === 'polecat') {
				const hookData = (rig.hooks || []).find((h) => h.agent === agent.address);
				polecats.push({
					id: agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name,
					name: agent.name.charAt(0).toUpperCase() + agent.name.slice(1),
					role: agent.role,
					rig: rig.name,
					status: agent.running ? 'running' : 'idle',
					has_work: agent.has_work || false,
					task: hookData?.bead_id || agent.first_subject || undefined
				});
			}
		}
	}

	const convoys: ConvoySnapshot[] = convoysData.slice(0, 10).map((c) => ({
		id: c.id,
		title: c.title,
		status: c.status,
		priority: c.priority || 2,
		issue_count: c.issue_count
	}));

	const recent_activity: ActivitySnapshot[] = activityData.slice(0, 10).map((item) => ({
		id: item.id,
		title: item.title,
		type: item.issue_type || item.type || 'unknown',
		status: item.status,
		updated_at: item.updated_at || ''
	}));

	const mail: MailSummary = {
		unread: mailData.filter((m) => m.status === 'open').length,
		total: mailData.length
	};

	const queue: QueueSummary = {
		pending: gtStatus.queue?.pending || 0,
		inProgress: gtStatus.queue?.in_progress || 0,
		total: gtStatus.queue?.total || 0
	};

	let health: HealthStatus = 'healthy';
	if (!gtStatus.rigs || gtStatus.rigs.length === 0) {
		health = 'degraded';
	}
	const offlineAgents = polecats.filter((p) => p.status !== 'running').length;
	if (offlineAgents > polecats.length / 2) {
		health = 'degraded';
	}

	const snapshot: GasТownSnapshot = {
		rigs,
		polecats,
		convoys,
		recent_activity,
		mail,
		queue,
		health,
		fetchedAt,
		timestamp: new Date().toISOString(),
		requestId
	};

	cachedSnapshot = snapshot;
	cacheTimestamp = now;

	return json(snapshot);
};
