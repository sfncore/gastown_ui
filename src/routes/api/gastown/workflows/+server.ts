/**
 * Workflows API Endpoint
 *
 * Lists and creates workflows.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	workflowsStore,
	type WorkflowStatus,
	type WorkflowType
} from '$lib/server/workflows-store';
import { z } from 'zod';

const CreateWorkflowSchema = z.object({
	type: z.enum(['merge-deploy', 'test-merge', 'full-ci', 'custom']),
	name: z.string().optional(),
	params: z.record(z.string(), z.unknown()).optional()
});

export const GET: RequestHandler = async ({ url }) => {
	const statusParam = url.searchParams.get('status') as WorkflowStatus | null;
	const typeParam = url.searchParams.get('type') as WorkflowType | null;

	const filters: { status?: WorkflowStatus; type?: WorkflowType } = {};
	if (statusParam) filters.status = statusParam;
	if (typeParam) filters.type = typeParam;

	const workflows = workflowsStore.list(filters);

	return json({
		data: workflows,
		meta: {
			count: workflows.length,
			timestamp: new Date().toISOString()
		}
	});
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const parseResult = CreateWorkflowSchema.safeParse(body);
	if (!parseResult.success) {
		const errors = parseResult.error.flatten().fieldErrors;
		return json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { type, name, params } = parseResult.data;
	const workflow = workflowsStore.create(type, name || type, params || {});

	return json(
		{
			data: workflow,
			meta: { timestamp: new Date().toISOString() }
		},
		{ status: 201 }
	);
};
