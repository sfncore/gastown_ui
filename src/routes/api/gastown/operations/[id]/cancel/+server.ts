/**
 * Operation Cancel API Endpoint
 *
 * Cancels an in-progress operation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { operationsStore } from '$lib/server/operations-store';

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Operation ID required' }, { status: 400 });
	}

	const result = operationsStore.cancel(id);

	if (!result.success) {
		return json({ error: result.error }, { status: 400 });
	}

	return json({
		data: { cancelled: true, id },
		meta: { timestamp: new Date().toISOString() }
	});
};
