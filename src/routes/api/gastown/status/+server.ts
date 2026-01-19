import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

interface GtStatus {
	name: string;
	agents?: unknown[];
	rigs?: unknown[];
}

export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const supervisor = getProcessSupervisor();

	try {
		const result = await supervisor.gt<GtStatus>(['status', '--json']);

		if (!result.success) {
			console.error('Failed to fetch gt status:', result.error);
			return json(
				{
					error: result.error || 'Failed to fetch status',
					requestId
				},
				{ status: 500 }
			);
		}

		return json({
			...result.data,
			requestId
		});
	} catch (error) {
		console.error('Failed to fetch gt status:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch status',
				requestId
			},
			{ status: 500 }
		);
	}
};
