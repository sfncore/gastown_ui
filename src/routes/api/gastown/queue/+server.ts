/**
 * Merge Queue API Endpoint
 *
 * Returns merge queue items for all rigs.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

interface QueueItem {
	id: string;
	branch: string;
	rig: string;
	status: string;
	position: number;
	worker?: string;
	createdAt: string;
}

interface GtStatus {
	rigs?: Array<{ name: string }>;
}

async function getRigs(): Promise<string[]> {
	const supervisor = getProcessSupervisor();
	try {
		const result = await supervisor.gt<GtStatus>(['status', '--json'], { timeout: 10_000 });
		if (!result.success || !result.data) return [];
		return (result.data.rigs || []).map((r) => r.name);
	} catch {
		return [];
	}
}

async function getQueueForRig(rig: string): Promise<QueueItem[]> {
	const supervisor = getProcessSupervisor();
	try {
		const result = await supervisor.gt<Record<string, unknown>[]>(['mq', 'list', rig, '--json'], {
			timeout: 10_000
		});

		if (!result.success || !result.data) return [];
		const items = result.data;
		if (!Array.isArray(items)) return [];

		return items.map((item: Record<string, unknown>, index: number) => ({
			id: String(item.id || `${rig}-${index}`),
			branch: String(item.branch || item.source_branch || ''),
			rig,
			status: String(item.status || 'pending'),
			position: index + 1,
			worker: item.worker ? String(item.worker) : undefined,
			createdAt: String(item.created_at || new Date().toISOString())
		}));
	} catch {
		return [];
	}
}

let cachedResponse: { items: QueueItem[]; queueLength: number; timestamp: string; requestId: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;

export const GET: RequestHandler = async ({ url }) => {
	const requestId = randomUUID();
	const now = Date.now();
	const rigFilter = url.searchParams.get('rig');

	if (!rigFilter && cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
		return json({ ...cachedResponse, requestId });
	}

	try {
		const rigs = rigFilter ? [rigFilter] : await getRigs();
		const allItems: QueueItem[] = [];

		for (const rig of rigs) {
			const items = await getQueueForRig(rig);
			allItems.push(...items);
		}

		allItems.sort((a, b) => a.position - b.position);

		const response = {
			items: allItems,
			queueLength: allItems.length,
			timestamp: new Date().toISOString(),
			requestId
		};

		if (!rigFilter) {
			cachedResponse = response;
			cacheTimestamp = now;
		}

		return json(response);
	} catch (error) {
		console.error('Failed to fetch queue:', error);
		return json(
			{
				items: [],
				queueLength: 0,
				error: error instanceof Error ? error.message : 'Failed to fetch queue',
				timestamp: new Date().toISOString(),
				requestId
			},
			{ status: 500 }
		);
	}
};
