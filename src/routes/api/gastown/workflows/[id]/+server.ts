/**
 * Workflow Detail API Endpoint
 *
 * Gets details of a specific workflow.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { workflowsStore } from '$lib/server/workflows-store';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Workflow ID required' }, { status: 400 });
	}

	const workflow = workflowsStore.get(id);

	if (!workflow) {
		return json({ error: 'Workflow not found' }, { status: 404 });
	}

	return json({
		data: workflow,
		meta: { fetchedAt: new Date().toISOString() }
	});
};
