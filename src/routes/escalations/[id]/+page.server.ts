import { getProcessSupervisor } from '$lib/server/cli';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface DecisionOption {
	label: string;
	value: string;
}

export interface Escalation {
	id: string;
	title: string;
	description: string;
	severity: Severity;
	category: string;
	timestamp: string;
	createdBy: string;
	updatedAt: string;
	status: string;
	isDecision: boolean;
	question?: string;
	options?: DecisionOption[];
	labels?: string[];
}

interface BeadsIssue {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority: number;
	issue_type: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	labels?: string[];
}

/**
 * Map priority (0-4) to severity level
 */
function mapPriorityToSeverity(priority: number): Severity {
	switch (priority) {
		case 0:
			return 'CRITICAL';
		case 1:
			return 'HIGH';
		case 2:
			return 'MEDIUM';
		default:
			return 'LOW';
	}
}

/**
 * Extract category from title or description
 */
function extractCategory(title: string): string {
	const bracketMatch = title.match(/^\[([^\]]+)\]/);
	if (bracketMatch) {
		return bracketMatch[1];
	}

	const colonMatch = title.match(/^([^:]+):/);
	if (colonMatch && colonMatch[1].length < 20) {
		return colonMatch[1].trim();
	}

	const lowerTitle = title.toLowerCase();
	if (lowerTitle.includes('decision')) return 'Decision';
	if (lowerTitle.includes('conflict')) return 'Merge Conflict';
	if (lowerTitle.includes('blocked')) return 'Blocked';
	if (lowerTitle.includes('failure') || lowerTitle.includes('failed')) return 'Failure';
	if (lowerTitle.includes('timeout')) return 'Timeout';

	return 'General';
}

/**
 * Parse decision options from description
 */
function parseDecision(description?: string): {
	isDecision: boolean;
	question?: string;
	options?: DecisionOption[];
} {
	if (!description) return { isDecision: false };

	const questionMatch = description.match(/(?:Question|Decision):\s*(.+?)(?:\n|$)/i);
	const optionsMatch = description.match(/Options?:\s*\n((?:\s*-\s*.+\n?)+)/i);

	if (!questionMatch || !optionsMatch) {
		return { isDecision: false };
	}

	const question = questionMatch[1].trim();
	const optionsText = optionsMatch[1];
	const options: DecisionOption[] = [];

	const optionLines = optionsText.split('\n').filter((line) => line.trim().startsWith('-'));
	for (const line of optionLines) {
		const optionMatch = line.match(/-\s*([^:]+)(?::\s*(.+))?/);
		if (optionMatch) {
			options.push({
				label: optionMatch[1].trim(),
				value: optionMatch[2]?.trim() || optionMatch[1].trim()
			});
		}
	}

	if (options.length === 0) {
		return { isDecision: false };
	}

	return { isDecision: true, question, options };
}

/**
 * Clean title by removing category prefix
 */
function cleanTitle(title: string): string {
	return title.replace(/^\[[^\]]+\]\s*/, '').replace(/^[^:]+:\s*/, '');
}

export const load: PageServerLoad = async ({ params }) => {
	try {
		// Use async ProcessSupervisor instead of blocking execSync
		const supervisor = getProcessSupervisor();
		const result = await supervisor.bd<BeadsIssue>(['show', params.id, '--json'], {
			timeout: 10000,
			cwd: '/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp'
		});

		if (!result.success || !result.data) {
			throw new Error(result.error || 'Failed to fetch escalation');
		}

		const issue: BeadsIssue = result.data;
		const decision = parseDecision(issue.description);

		const escalation: Escalation = {
			id: issue.id,
			title: cleanTitle(issue.title),
			description: issue.description || '',
			severity: mapPriorityToSeverity(issue.priority),
			category: extractCategory(issue.title),
			timestamp: issue.created_at,
			createdBy: issue.created_by,
			updatedAt: issue.updated_at,
			status: issue.status,
			labels: issue.labels,
			...decision
		};

		return {
			escalation,
			error: null
		};
	} catch (err) {
		const errorMessage =
			err instanceof Error ? err.message : 'Unknown error fetching escalation';

		// Check if it's a "not found" error
		if (errorMessage.includes('no issue found') || errorMessage.includes('not found')) {
			throw error(404, {
				message: `Escalation ${params.id} not found`
			});
		}

		throw error(500, {
			message: errorMessage
		});
	}
};
