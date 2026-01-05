import { readFileSync, existsSync } from 'fs';
import type { PageServerLoad } from './$types';

// Town root where .events.jsonl lives
const TOWN_ROOT = '/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp';
const EVENTS_FILE = `${TOWN_ROOT}/.events.jsonl`;

interface GasTownEvent {
	ts: string;
	source: string;
	type: string;
	actor: string;
	payload?: Record<string, unknown>;
	visibility?: string;
}

type LogLevel = 'INF' | 'WRN' | 'ERR' | 'DBG';

interface LogEntry {
	id: string;
	timestamp: string;
	level: LogLevel;
	message: string;
	actor: string;
	type: string;
}

/**
 * Map event type to log level
 */
function getLogLevel(type: string): LogLevel {
	const errorTypes = ['error', 'failure', 'crash', 'panic'];
	const warnTypes = ['warning', 'timeout', 'retry', 'conflict'];
	const debugTypes = ['nudge', 'heartbeat', 'ping', 'check'];

	const typeLower = type.toLowerCase();

	if (errorTypes.some((t) => typeLower.includes(t))) return 'ERR';
	if (warnTypes.some((t) => typeLower.includes(t))) return 'WRN';
	if (debugTypes.some((t) => typeLower.includes(t))) return 'DBG';
	return 'INF';
}

/**
 * Format actor name for display
 */
function formatActor(actor: string): string {
	// Extract polecat name if it's a path like "gastown_ui/polecats/furiosa"
	if (actor.includes('/polecats/')) {
		const parts = actor.split('/');
		return `Polecat ${parts[parts.length - 1]}`;
	}
	if (actor.includes('/witness')) {
		return 'Witness';
	}
	if (actor.includes('/refinery')) {
		return 'Refinery';
	}
	// Capitalize first letter
	return actor.charAt(0).toUpperCase() + actor.slice(1);
}

/**
 * Build a human-readable message from event type and payload
 */
function buildMessage(event: GasTownEvent): string {
	const actor = formatActor(event.actor);
	const payload = event.payload || {};

	switch (event.type) {
		case 'session_start':
			return `[${actor}] Session started${payload.topic ? ` (${payload.topic})` : ''}`;

		case 'spawn':
			return `[${actor}] Spawned polecat ${payload.polecat} in ${payload.rig}`;

		case 'nudge':
			return `[${actor}] Nudged ${payload.target}: ${payload.reason || 'no reason given'}`;

		case 'mail_sent':
			return `[${actor}] Sent mail to ${payload.to}: ${payload.subject || 'no subject'}`;

		case 'mail_received':
			return `[${actor}] Received mail from ${payload.from}`;

		case 'work_started':
			return `[${actor}] Started work on ${payload.bead || payload.issue || 'task'}`;

		case 'work_completed':
			return `[${actor}] Completed ${payload.bead || payload.issue || 'task'}`;

		case 'merge':
			return `[${actor}] Merged branch ${payload.branch} to main`;

		case 'test_pass':
			return `[${actor}] Tests passed for ${payload.branch || 'branch'}`;

		case 'test_fail':
			return `[${actor}] Tests failed for ${payload.branch || 'branch'}`;

		case 'error':
			return `[${actor}] Error: ${payload.message || payload.error || 'unknown error'}`;

		default:
			// Generic format for unknown types
			const details = Object.entries(payload)
				.filter(([k]) => !['actor_pid', 'cwd', 'session_id'].includes(k))
				.map(([k, v]) => `${k}=${v}`)
				.join(', ');
			return `[${actor}] ${event.type}${details ? `: ${details}` : ''}`;
	}
}

export const load: PageServerLoad = async () => {
	try {
		// Check if file exists
		if (!existsSync(EVENTS_FILE)) {
			return {
				logs: [],
				error: null,
				sources: []
			};
		}

		// Read and parse JSONL file
		const content = readFileSync(EVENTS_FILE, 'utf-8');
		const lines = content.split('\n').filter((line: string) => line.trim());

		const events: GasTownEvent[] = [];
		for (const line of lines) {
			try {
				events.push(JSON.parse(line));
			} catch {
				// Skip malformed lines
				continue;
			}
		}

		// Convert to log entries
		const logs: LogEntry[] = events.map((event, index) => ({
			id: `${index}`,
			timestamp: event.ts,
			level: getLogLevel(event.type),
			message: buildMessage(event),
			actor: event.actor,
			type: event.type
		}));

		// Get unique actors for source filter
		const sources = [...new Set(events.map((e) => formatActor(e.actor)))].sort();

		// Return most recent 100, newest first
		const recentLogs = logs.reverse().slice(0, 100);

		return {
			logs: recentLogs,
			error: null,
			sources
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error reading events';
		return {
			logs: [],
			error: errorMessage,
			sources: []
		};
	}
};
