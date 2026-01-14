/**
 * SSE Activity Stream Endpoint
 *
 * Server-Sent Events for real-time activity updates.
 */

import type { RequestHandler } from './$types';
import { tailEventsFile, readLastNEvents } from '$lib/server/watchers/events-tailer';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function getTownRoot(): Promise<string | null> {
	try {
		const { stdout } = await execAsync('gt status --json', { timeout: 5_000 });
		const status = JSON.parse(stdout);
		return status.location || null;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const townRoot = await getTownRoot();

	if (!townRoot) {
		return new Response(JSON.stringify({ error: 'Town root not found' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const eventsPath = `${townRoot}/.beads/.events.jsonl`;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: unknown) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					/* controller might be closed */
				}
			};

			try {
				const initialEvents = await readLastNEvents(eventsPath, 50);
				for (const event of initialEvents) {
					sendEvent(event);
				}
			} catch {
				/* no initial events */
			}

			const unsubscribe = tailEventsFile(eventsPath, (event) => {
				sendEvent(event);
			});

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: heartbeat\n\n`));
				} catch {
					/* controller might be closed */
				}
			}, 30_000);

			request.signal.addEventListener('abort', () => {
				unsubscribe();
				clearInterval(heartbeat);
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
