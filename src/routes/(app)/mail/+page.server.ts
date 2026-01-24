/**
 * Mail Inbox Page Server Load
 *
 * Fetches mail inbox data from gt mail command.
 * Parses subject lines to extract message types.
 */

import type { PageServerLoad } from './$types';
import { execGt } from '$lib/server/gt';

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
		subject: msg.subject,
		body: msg.body,
		timestamp: msg.timestamp,
		read: msg.read,
		priority: msg.priority,
		messageType: parseMessageType(msg.subject),
		threadId: msg.thread_id
	};
}

export const load: PageServerLoad = async () => {
	try {
		const { stdout } = await execGt('gt mail inbox --json', {
			timeout: 5000
		});

		const rawMessages: GtMailMessage[] | null = JSON.parse(stdout);
		const messages = (rawMessages ?? []).map(transformMessage);

		// Sort: unread first, then by timestamp descending
		messages.sort((a, b) => {
			if (a.read !== b.read) return a.read ? 1 : -1;
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		});

		const unreadCount = messages.filter((m) => !m.read).length;

		return {
			messages,
			unreadCount,
			error: null,
			fetchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to fetch mail inbox:', err);

		return {
			messages: [],
			unreadCount: 0,
			error: 'Failed to fetch mail inbox',
			fetchedAt: new Date().toISOString()
		};
	}
};
