/**
 * Workflow Retry API Endpoint
 *
 * Retries a failed workflow step.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { workflowsStore } from '$lib/server/workflows-store';
import { z } from 'zod';

const RetryRequestSchema = z.object({
	stepId: z.string().min(1)
});

export const POST: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Workflow ID required' }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const parseResult = RetryRequestSchema.safeParse(body);
	if (!parseResult.success) {
		return json({ error: 'stepId is required' }, { status: 400 });
	}

	const { stepId } = parseResult.data;
	const result = workflowsStore.retryStep(id, stepId);

	if (!result.success) {
		return json({ error: result.error }, { status: 400 });
	}

	const workflow = workflowsStore.get(id);

	return json({
		data: {
			retried: true,
			workflowId: id,
			stepId,
			workflow
		},
		meta: { timestamp: new Date().toISOString() }
	});
};
