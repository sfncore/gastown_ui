import type { PageServerLoad } from './$types';
import { getProcessSupervisor } from '$lib/server/cli/process-supervisor';

type ConvoyStatus = 'active' | 'stale' | 'stuck' | 'complete';
type IssueStatus = 'open' | 'in_progress' | 'closed' | 'blocked';

interface TrackedIssue {
	id: string;
	title: string;
	status: IssueStatus;
	issue_type: string;
	assignee?: string;
}

interface ConvoyDetail {
	id: string;
	title: string;
	status: string;
	tracked: TrackedIssue[];
	completed: number;
	total: number;
}

interface ConvoySummary {
	id: string;
	title: string;
	status: string;
	created_at: string;
}

export interface Convoy {
	id: string;
	title: string;
	status: ConvoyStatus;
	progress: number;
	completed: number;
	total: number;
	createdAt: string;
	tracked: TrackedIssue[];
}

function determineConvoyStatus(detail: ConvoyDetail): ConvoyStatus {
	if (detail.status === 'closed' || detail.completed === detail.total) {
		return 'complete';
	}

	// Check if any tracked issues are blocked
	const hasBlocked = detail.tracked.some((t) => t.status === 'blocked');
	if (hasBlocked) {
		return 'stuck';
	}

	// Check if any tracked issues are actively being worked on
	const hasInProgress = detail.tracked.some((t) => t.status === 'in_progress');
	if (hasInProgress) {
		return 'active';
	}

	// All issues are open but none in progress
	const allOpen = detail.tracked.every((t) => t.status === 'open');
	if (allOpen && detail.total > 0) {
		return 'stale';
	}

	return 'active';
}

async function getConvoyDetail(id: string): Promise<ConvoyDetail | null> {
	const supervisor = getProcessSupervisor();
	// SECURITY: Using args array prevents shell injection - id passed as separate argument
	const result = await supervisor.gt<ConvoyDetail>(['convoy', 'status', id, '--json']);
	if (result.success && result.data) {
		return result.data;
	}
	return null;
}

export const load: PageServerLoad = async () => {
	try {
		// Fetch convoy list using ProcessSupervisor (secure, no shell)
		const supervisor = getProcessSupervisor();
		const result = await supervisor.gt<ConvoySummary[]>(['convoy', 'list', '--json']);

		if (!result.success || !result.data) {
			return { convoys: [], error: result.error || 'Failed to fetch convoys' };
		}

		const summaries: ConvoySummary[] = result.data;

		// Fetch details for each convoy in parallel
		const detailPromises = summaries.map((s) => getConvoyDetail(s.id));
		const details = await Promise.all(detailPromises);

		// Transform to UI format
		const convoys: Convoy[] = summaries.map((summary, i) => {
			const detail = details[i];
			if (detail) {
				return {
					id: detail.id,
					title: detail.title,
					status: determineConvoyStatus(detail),
					progress: detail.total > 0 ? Math.round((detail.completed / detail.total) * 100) : 0,
					completed: detail.completed,
					total: detail.total,
					createdAt: summary.created_at,
					tracked: detail.tracked
				};
			}
			// Fallback if detail fetch failed
			return {
				id: summary.id,
				title: summary.title,
				status: 'stale' as ConvoyStatus,
				progress: 0,
				completed: 0,
				total: 0,
				createdAt: summary.created_at,
				tracked: []
			};
		});

		return { convoys, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch convoys';
		return { convoys: [], error: message };
	}
};
