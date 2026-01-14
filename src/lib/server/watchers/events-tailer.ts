/**
 * Events File Tailer
 *
 * Tails the .events.jsonl file for real-time updates.
 */

import { watch, createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { createInterface } from 'readline';

export interface BeadEvent {
	type: string;
	timestamp: string;
	data: Record<string, unknown>;
}

export type EventCallback = (event: BeadEvent) => void;

export function tailEventsFile(eventsPath: string, callback: EventCallback): () => void {
	let fileSize = 0;
	let watching = true;

	const processNewLines = async () => {
		if (!watching) return;

		try {
			const stats = await stat(eventsPath);
			if (stats.size <= fileSize) return;

			const stream = createReadStream(eventsPath, {
				start: fileSize,
				encoding: 'utf-8'
			});

			const rl = createInterface({ input: stream });

			for await (const line of rl) {
				if (!watching) break;
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const event = JSON.parse(trimmed) as BeadEvent;
					callback(event);
				} catch {
					/* skip malformed JSON */
				}
			}

			fileSize = stats.size;
		} catch {
			/* file might not exist yet */
		}
	};

	stat(eventsPath)
		.then((stats) => {
			fileSize = stats.size;
		})
		.catch(() => {
			/* file doesn't exist yet */
		});

	const watcher = watch(eventsPath, (eventType) => {
		if (eventType === 'change') {
			processNewLines();
		}
	});

	watcher.on('error', () => {
		/* ignore watch errors */
	});

	return () => {
		watching = false;
		watcher.close();
	};
}

export async function readLastNEvents(eventsPath: string, n: number): Promise<BeadEvent[]> {
	const events: BeadEvent[] = [];

	try {
		const stream = createReadStream(eventsPath, { encoding: 'utf-8' });
		const rl = createInterface({ input: stream });

		for await (const line of rl) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			try {
				const event = JSON.parse(trimmed) as BeadEvent;
				events.push(event);
				if (events.length > n) {
					events.shift();
				}
			} catch {
				/* skip malformed */
			}
		}
	} catch {
		/* file might not exist */
	}

	return events;
}
