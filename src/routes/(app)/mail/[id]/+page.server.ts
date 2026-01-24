/**
 * Mail Detail Page Server Load
 *
 * Fetches a single mail message by ID using ProcessSupervisor (secure, no shell).
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProcessSupervisor } from '$lib/server/cli/process-supervisor';

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

	// SECURITY: Using ProcessSupervisor with args array prevents shell injection
	// The 'id' is passed as a separate argument, never interpolated into a shell command
	const supervisor = getProcessSupervisor();
	const result = await supervisor.gt<GtMailMessage>(['mail', 'read', id, '--json'], {
		timeout: 5000
	});

	if (!result.success || !result.data) {
		console.error(`Failed to fetch mail message ${id}:`, result.error);
		throw error(404, {
			message: `Message ${id} not found`
		});
	}

	const message = transformMessage(result.data);

	return {
		message,
		error: null
	};
};
