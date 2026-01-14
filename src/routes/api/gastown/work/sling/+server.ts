/**
 * Sling Work API Endpoint
 *
 * Assigns work to agents/rigs.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execAsync = promisify(exec);

const SlingRequestSchema = z.object({
	beadId: z
		.string()
		.min(1)
		.regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bead ID format'),
	agentId: z
		.string()
		.min(1)
		.regex(/^[a-zA-Z0-9/_-]+$/, 'Invalid agent ID format'),
	priority: z.number().int().min(1).max(4).optional(),
	createBranch: z.boolean().optional()
});

/** POST: Sling work to an agent */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const parseResult = SlingRequestSchema.safeParse(body);
	if (!parseResult.success) {
		const errors = parseResult.error.flatten().fieldErrors;
		return json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { beadId, agentId, priority, createBranch } = parseResult.data;

	const args = ['sling', beadId, agentId];
	if (priority) args.push('--priority', String(priority));
	if (createBranch) args.push('--create');

	try {
		const { stdout } = await execAsync(`gt ${args.join(' ')}`, {
			timeout: 30_000
		});

		return json(
			{
				success: true,
				data: {
					beadId,
					assignedTo: agentId,
					message: stdout.trim()
				},
				meta: { timestamp: new Date().toISOString() }
			},
			{ status: 201 }
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('Failed to sling work:', error);

		return json(
			{
				success: false,
				error: 'Failed to sling work',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
};
