import { error } from '@sveltejs/kit';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';
import { getProcessSupervisor } from '$lib/server/cli/process-supervisor';

function getGtRoot(): string {
	if (process.env.GT_TOWN_ROOT) {
		return process.env.GT_TOWN_ROOT;
	}
	const cwd = process.cwd();
	return resolve(cwd, '..', '..', '..');
}

type ConvoyStatus = 'active' | 'stale' | 'stuck' | 'complete';
type IssueStatus = 'open' | 'in_progress' | 'closed' | 'blocked' | 'unknown';

interface TrackedIssue {
	id: string;
	title: string;
	status: IssueStatus;
	issue_type: string;
	assignee?: string;
	dependency_type?: string;
}

interface ConvoyRaw {
	id: string;
	title: string;
	status: string;
	tracked: TrackedIssue[];
	completed: number;
	total: number;
	created_at?: string;
}

export interface ConvoyDetail {
	id: string;
	title: string;
	status: ConvoyStatus;
	rawStatus: string;
	progress: number;
	completed: number;
	total: number;
	createdAt: string;
	tracked: TrackedIssue[];
	workers: string[];
}

function determineConvoyStatus(convoy: ConvoyRaw): ConvoyStatus {
	if (convoy.status === 'closed' || convoy.completed === convoy.total) {
		return 'complete';
	}

	const hasBlocked = convoy.tracked.some((t) => t.status === 'blocked');
	if (hasBlocked) {
		return 'stuck';
	}

	const hasInProgress = convoy.tracked.some((t) => t.status === 'in_progress');
	if (hasInProgress) {
		return 'active';
	}

	const allOpen = convoy.tracked.every((t) => t.status === 'open' || t.status === 'unknown');
	if (allOpen && convoy.total > 0) {
		return 'stale';
	}

	return 'active';
}

function extractWorkers(tracked: TrackedIssue[]): string[] {
	const workers = new Set<string>();
	for (const issue of tracked) {
		if (issue.assignee) {
			workers.add(issue.assignee);
		}
	}
	return Array.from(workers);
}

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;
	const gtRoot = getGtRoot();

	try {
		const supervisor = getProcessSupervisor();
		const result = await supervisor.gt<ConvoyRaw>(['convoy', 'status', id, '--json'], {
			cwd: gtRoot
		});

		if (!result.success || !result.data) {
			const message = result.error || 'Failed to fetch convoy';
			if (message.includes('not found') || message.includes('No convoy')) {
				error(404, { message: `Convoy not found: ${id}` });
			}
			error(500, { message });
		}

		const raw: ConvoyRaw = result.data;

		// Try to get created_at from convoy list
		let createdAt = raw.created_at || '';
		if (!createdAt) {
			try {
				const listResult = await supervisor.gt<Array<{ id: string; created_at?: string }>>(['convoy', 'list', '--json'], {
					cwd: gtRoot
				});
				if (listResult.success && listResult.data) {
					const summary = listResult.data.find((s) => s.id === id);
					if (summary?.created_at) {
						createdAt = summary.created_at;
					}
				}
			} catch {
				// Ignore - created_at is optional
			}
		}

		const convoy: ConvoyDetail = {
			id: raw.id,
			title: raw.title,
			status: determineConvoyStatus(raw),
			rawStatus: raw.status,
			progress: raw.total > 0 ? Math.round((raw.completed / raw.total) * 100) : 0,
			completed: raw.completed,
			total: raw.total,
			createdAt,
			tracked: raw.tracked,
			workers: extractWorkers(raw.tracked)
		};

		return { convoy, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch convoy';
		if (message.includes('not found') || message.includes('No convoy')) {
			error(404, { message: `Convoy not found: ${id}` });
		}
		error(500, { message });
	}
};
