/**
 * Operations API Endpoint
 *
 * Lists all tracked operations.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { operationsStore, type OperationStatus, type OperationType } from '$lib/server/operations-store';

export const GET: RequestHandler = async ({ url }) => {
	const statusParam = url.searchParams.get('status') as OperationStatus | null;
	const typeParam = url.searchParams.get('type') as OperationType | null;

	const filters: { status?: OperationStatus; type?: OperationType } = {};
	if (statusParam) filters.status = statusParam;
	if (typeParam) filters.type = typeParam;

	const operations = operationsStore.list(filters);

	return json({
		data: operations,
		meta: {
			count: operations.length,
			timestamp: new Date().toISOString()
		}
	});
};
