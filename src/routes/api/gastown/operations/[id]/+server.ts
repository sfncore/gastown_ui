/**
 * Operation Detail API Endpoint
 *
 * Gets details of a specific operation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { operationsStore } from '$lib/server/operations-store';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Operation ID required' }, { status: 400 });
	}

	const operation = operationsStore.get(id);

	if (!operation) {
		return json({ error: 'Operation not found' }, { status: 404 });
	}

	return json({
		data: operation,
		meta: { fetchedAt: new Date().toISOString() }
	});
};
