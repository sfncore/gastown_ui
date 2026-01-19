import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

/** POST: Create a new convoy */
export const POST: RequestHandler = async ({ request }) => {
	const requestId = randomUUID();
	const supervisor = getProcessSupervisor();

	try {
		const body = await request.json();
		const { name, issues } = body;

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: 'Convoy name is required', requestId }, { status: 400 });
		}

		if (!issues || !Array.isArray(issues) || issues.length === 0) {
			return json({ error: 'At least one issue is required', requestId }, { status: 400 });
		}

		const sanitizedName = name.replace(/['"\\$`]/g, '');
		const sanitizedIssues = issues.filter(
			(id): id is string => typeof id === 'string' && /^[a-z0-9-]+$/i.test(id)
		);

		if (sanitizedIssues.length === 0) {
			return json({ error: 'Invalid issue IDs', requestId }, { status: 400 });
		}

		const args = ['convoy', 'create', sanitizedName, ...sanitizedIssues];

		const result = await supervisor.gt<string>(args, { timeout: 30_000 });

		if (!result.success) {
			console.error('Failed to create convoy:', result.error);
			return json(
				{ error: result.error || 'Failed to create convoy', requestId },
				{ status: 500 }
			);
		}

		return json(
			{
				success: true,
				message: typeof result.data === 'string' ? result.data.trim() : result.data,
				requestId
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create convoy:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create convoy', requestId },
			{ status: 500 }
		);
	}
};
