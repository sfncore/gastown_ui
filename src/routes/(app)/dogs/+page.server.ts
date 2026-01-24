import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PageServerLoad } from './$types';

type TriageDecision = 'START' | 'WAKE' | 'NUDGE' | 'NOTHING' | 'unknown';

interface BootStatus {
	status: 'online' | 'offline' | 'unknown';
	lastTriage: TriageDecision;
	lastTriageTime: string | null;
	lastTriageTarget: string | null;
	patrolCount: number;
	markerFiles: Record<string, { path: string; exists: boolean; stale: boolean }>;
}

interface HeartbeatData {
	timestamp: string;
	rigs: string[];
	interval: number;
}

interface DogsData {
	timestamp: string;
	boot: BootStatus;
	heartbeat: HeartbeatData | null;
	error: string | null;
}

async function readJsonFile<T>(path: string): Promise<T | null> {
	try {
		const content = await readFile(path, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async () => {
	const gtRoot = join(homedir(), 'gt');
	const bootStatusPath = join(gtRoot, 'deacon', 'dogs', 'boot', '.boot-status.json');
	const heartbeatPath = join(gtRoot, 'deacon', 'heartbeat.json');

	try {
		// Read boot status
		const bootRaw = await readJsonFile<{
			status?: string;
			last_triage?: string;
			last_triage_time?: string;
			last_triage_target?: string;
			patrol_count?: number;
			marker_files?: Record<string, { path: string; exists: boolean; stale: boolean }>;
		}>(bootStatusPath);

		const boot: BootStatus = bootRaw
			? {
					status: (bootRaw.status as 'online' | 'offline') || 'unknown',
					lastTriage: (bootRaw.last_triage as TriageDecision) || 'unknown',
					lastTriageTime: bootRaw.last_triage_time || null,
					lastTriageTarget: bootRaw.last_triage_target || null,
					patrolCount: bootRaw.patrol_count || 0,
					markerFiles: bootRaw.marker_files || {}
				}
			: {
					status: 'unknown',
					lastTriage: 'unknown',
					lastTriageTime: null,
					lastTriageTarget: null,
					patrolCount: 0,
					markerFiles: {}
				};

		// Read heartbeat
		const heartbeatRaw = await readJsonFile<{
			timestamp?: string;
			rigs?: string[];
			interval?: number;
		}>(heartbeatPath);

		const heartbeat: HeartbeatData | null = heartbeatRaw
			? {
					timestamp: heartbeatRaw.timestamp || new Date().toISOString(),
					rigs: heartbeatRaw.rigs || [],
					interval: heartbeatRaw.interval || 30
				}
			: null;

		const dogsData: DogsData = {
			timestamp: new Date().toISOString(),
			boot,
			heartbeat,
			error: null
		};

		return { dogs: dogsData };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load dogs status';
		return {
			dogs: {
				timestamp: new Date().toISOString(),
				boot: {
					status: 'unknown',
					lastTriage: 'unknown',
					lastTriageTime: null,
					lastTriageTarget: null,
					patrolCount: 0,
					markerFiles: {}
				},
				heartbeat: null,
				error: message
			} as DogsData
		};
	}
};
