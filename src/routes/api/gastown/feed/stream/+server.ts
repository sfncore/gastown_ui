/**
 * SSE Activity Stream Endpoint
 *
 * Server-Sent Events for real-time activity updates.
 * Includes cache invalidation events from beads-watcher.
 */

import type { RequestHandler } from './$types';
import { tailEventsFile, readLastNEvents } from '$lib/server/watchers/events-tailer';
import { getProcessSupervisor } from '$lib/server/cli';
import { initBeadsWatcher, cacheEventEmitter, type CacheInvalidationEvent } from '$lib/server/watch';

async function getTownRoot(): Promise<string | null> {
	const supervisor = getProcessSupervisor();
	try {
		const result = await supervisor.gt<{ location?: string }>(['status', '--json'], {
			timeout: 5_000
		});

		if (!result.success || !result.data) {
			return null;
		}

		return result.data.location || null;
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
	const beadsPath = `${townRoot}/.beads`;

	// Initialize beads watcher for cache invalidation events
	try {
		await initBeadsWatcher(beadsPath);
	} catch {
		// Watcher init failure is non-fatal, continue with event tailing
	}

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

			// Subscribe to file-based events
			const unsubscribe = tailEventsFile(eventsPath, (event) => {
				sendEvent(event);
			});

			// Subscribe to cache invalidation events from beads-watcher
			const handleCacheInvalidation = (event: CacheInvalidationEvent) => {
				sendEvent(event);
			};
			cacheEventEmitter.onInvalidation(handleCacheInvalidation);

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: heartbeat\n\n`));
				} catch {
					/* controller might be closed */
				}
			}, 30_000);

			request.signal.addEventListener('abort', () => {
				unsubscribe();
				cacheEventEmitter.offInvalidation(handleCacheInvalidation);
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
