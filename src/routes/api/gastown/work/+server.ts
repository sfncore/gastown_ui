/**
 * Work API Endpoint
 *
 * Returns all work items from the beads database with filtering support.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface WorkItem {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority: number;
	issueType: string;
	assignee: string | null;
	labels: string[];
	createdAt: string;
	updatedAt: string;
	createdBy: string;
}

interface BdBead {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	labels?: string[];
	created_at: string;
	updated_at: string;
	created_by: string;
}

function transformBead(bead: BdBead): WorkItem {
	return {
		id: bead.id,
		title: bead.title,
		description: bead.description,
		status: bead.status,
		priority: bead.priority,
		issueType: bead.issue_type,
		assignee: bead.assignee || null,
		labels: bead.labels || [],
		createdAt: bead.created_at,
		updatedAt: bead.updated_at,
		createdBy: bead.created_by
	};
}

export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type');
	const status = url.searchParams.get('status');
	const priority = url.searchParams.get('priority');
	const assignee = url.searchParams.get('assignee');
	const labels = url.searchParams.get('labels');

	const args = ['list', '--json'];

	if (type && /^[a-zA-Z_]+$/.test(type)) {
		args.push(`--type=${type}`);
	}
	if (status && /^[a-zA-Z_]+$/.test(status)) {
		args.push(`--status=${status}`);
	}
	if (priority && /^[0-4]$/.test(priority)) {
		args.push(`--priority=${priority}`);
	}
	if (assignee && /^[a-zA-Z0-9/_-]+$/.test(assignee)) {
		args.push(`--assignee=${assignee}`);
	}
	if (labels && /^[a-zA-Z0-9:,_-]+$/.test(labels)) {
		for (const label of labels.split(',')) {
			args.push(`--label=${label.trim()}`);
		}
	}

	try {
		const { stdout } = await execAsync(`bd ${args.join(' ')}`, {
			timeout: 15_000
		});

		const beads: BdBead[] = JSON.parse(stdout) || [];
		const items = beads.map(transformBead);

		return json({
			items,
			total: items.length,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('no issues') || errorMessage.includes('no beads')) {
			return json({
				items: [],
				total: 0,
				timestamp: new Date().toISOString()
			});
		}

		console.error('Failed to fetch work items:', error);
		return json(
			{
				items: [],
				total: 0,
				error: errorMessage,
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
