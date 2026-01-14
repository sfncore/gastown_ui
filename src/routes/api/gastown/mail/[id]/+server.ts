/**
 * Mail Detail API Endpoint
 *
 * Retrieves individual mail message details by ID.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface BdBead {
	id: string;
	title: string;
	description: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	labels?: string[];
	ephemeral?: boolean;
	dependents?: Array<{ id: string; title: string; dependency_type: string }>;
	dependencies?: Array<{ id: string; title: string; dependency_type: string }>;
}

interface MailMessage {
	id: string;
	from: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	messageType: string;
	threadId: string;
	status: string;
	labels: string[];
	dependencies: Array<{ id: string; title: string; type: string }>;
	dependents: Array<{ id: string; title: string; type: string }>;
}

function parseMessageType(subject: string): string {
	const prefixMatch = subject.match(/^([A-Z_]+):/);
	if (prefixMatch) {
		return prefixMatch[1];
	}
	if (subject.includes('HANDOFF')) return 'HANDOFF';
	if (subject.includes('ESCALATION')) return 'ESCALATION';
	if (subject.includes('DONE')) return 'DONE';
	if (subject.includes('ERROR')) return 'ERROR';
	return 'MESSAGE';
}

function getThreadId(labels: string[]): string {
	const threadLabel = labels.find((l) => l.startsWith('thread:'));
	return threadLabel ? threadLabel.replace('thread:', '') : '';
}

function transformBead(bead: BdBead): MailMessage {
	const labels = bead.labels || [];
	return {
		id: bead.id,
		from: bead.created_by,
		subject: bead.title,
		body: bead.description || '',
		timestamp: bead.created_at,
		read: bead.status !== 'open',
		priority: bead.priority === 1 ? 'high' : bead.priority === 3 ? 'low' : 'normal',
		messageType: parseMessageType(bead.title),
		threadId: getThreadId(labels),
		status: bead.status,
		labels,
		dependencies: (bead.dependencies || []).map((d) => ({
			id: d.id,
			title: d.title,
			type: d.dependency_type
		})),
		dependents: (bead.dependents || []).map((d) => ({
			id: d.id,
			title: d.title,
			type: d.dependency_type
		}))
	};
}

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	try {
		const { stdout } = await execAsync(`bd show ${id} --json`, {
			timeout: 10_000
		});

		const beads: BdBead[] = JSON.parse(stdout);

		if (!beads || beads.length === 0) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		const bead = beads[0];

		if (bead.issue_type !== 'message') {
			return json({ error: 'Not a mail message' }, { status: 400 });
		}

		const message = transformBead(bead);

		return json({
			message,
			fetchedAt: new Date().toISOString()
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('no issue found') || errorMessage.includes('not found')) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		console.error(`Failed to fetch mail message ${id}:`, error);
		return json(
			{
				error: 'Failed to fetch message',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
};
