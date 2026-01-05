/**
 * Mail Detail Page Server Load
 *
 * Fetches a single mail message by ID using gt mail read command.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const execAsync = promisify(exec);

interface GtMailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	type: string;
	thread_id: string;
}

export interface MailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	messageType: string;
	threadId: string;
}

/**
 * Parse subject line to extract message type
 * Recognizes patterns like: "POLECAT_DONE: ...", "ESCALATION: ...", "HANDOFF: ..."
 */
function parseMessageType(subject: string): string {
	const prefixMatch = subject.match(/^([A-Z_]+):/);
	if (prefixMatch) {
		return prefixMatch[1];
	}

	// Check for emoji-prefixed types
	if (subject.includes('HANDOFF')) return 'HANDOFF';
	if (subject.includes('ESCALATION')) return 'ESCALATION';
	if (subject.includes('DONE')) return 'DONE';
	if (subject.includes('ERROR')) return 'ERROR';

	return 'MESSAGE';
}

/**
 * Transform raw mail message to display format
 */
function transformMessage(msg: GtMailMessage): MailMessage {
	return {
		id: msg.id,
		from: msg.from,
		to: msg.to,
		subject: msg.subject,
		body: msg.body,
		timestamp: msg.timestamp,
		read: msg.read,
		priority: msg.priority,
		messageType: parseMessageType(msg.subject),
		threadId: msg.thread_id
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	try {
		const { stdout } = await execAsync(`gt mail read ${id} --json`, {
			timeout: 5000
		});

		const rawMessage: GtMailMessage = JSON.parse(stdout);
		const message = transformMessage(rawMessage);

		return {
			message,
			error: null
		};
	} catch (err) {
		console.error(`Failed to fetch mail message ${id}:`, err);
		throw error(404, {
			message: `Message ${id} not found`
		});
	}
};
