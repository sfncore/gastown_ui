import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

/** GET: List all open issues */
export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const supervisor = getProcessSupervisor();

	try {
		const result = await supervisor.bd<unknown[]>(['list', '--status=open', '--json'], {
			timeout: 15_000
		});

		if (!result.success) {
			const errorMessage = result.error || 'Unknown error';

			if (errorMessage.includes('no issues') || errorMessage.includes('no beads')) {
				return json({ items: [], requestId });
			}

			console.error('Failed to fetch issues:', result.error);
			return json({ error: errorMessage, requestId }, { status: 500 });
		}

		return json({ items: result.data || [], requestId });
	} catch (error) {
		console.error('Failed to fetch issues:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch issues', requestId },
			{ status: 500 }
		);
	}
};

/** POST: Create a new issue */
export const POST: RequestHandler = async ({ request }) => {
	const requestId = randomUUID();
	const supervisor = getProcessSupervisor();

	try {
		const body = await request.json();
		const { title, type = 'task', priority = 2 } = body;

		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return json({ error: 'Title is required', requestId }, { status: 400 });
		}

		const sanitizedTitle = title.replace(/['"\\$`]/g, '');
		const validTypes = ['task', 'bug', 'feature', 'epic'];
		const sanitizedType = validTypes.includes(type) ? type : 'task';
		const sanitizedPriority = Math.max(0, Math.min(4, parseInt(String(priority), 10) || 2));

		const args = [
			'create',
			`--title=${sanitizedTitle}`,
			`--type=${sanitizedType}`,
			`--priority=${sanitizedPriority}`,
			'--json'
		];

		const result = await supervisor.bd<unknown>(args, { timeout: 15_000 });

		if (!result.success) {
			console.error('Failed to create issue:', result.error);
			return json(
				{ error: result.error || 'Failed to create issue', requestId },
				{ status: 500 }
			);
		}

		return json({ data: result.data, requestId }, { status: 201 });
	} catch (error) {
		console.error('Failed to create issue:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create issue', requestId },
			{ status: 500 }
		);
	}
};
