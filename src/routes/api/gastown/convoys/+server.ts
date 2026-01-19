import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

interface Convoy {
	id: string;
	title?: string;
	status?: string;
}

export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const supervisor = getProcessSupervisor();

	try {
		const result = await supervisor.bd<Convoy[]>(['list', '--type=convoy', '--status=open', '--json']);

		if (!result.success) {
			if (result.error?.includes('no issues')) {
				return json({ convoys: [], requestId });
			}
			console.error('Failed to fetch convoys:', result.error);
			return json(
				{
					error: result.error || 'Failed to fetch convoys',
					requestId
				},
				{ status: 500 }
			);
		}

		return json({
			convoys: result.data || [],
			requestId
		});
	} catch (error) {
		if (error instanceof Error && error.message.includes('no issues')) {
			return json({ convoys: [], requestId });
		}
		console.error('Failed to fetch convoys:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch convoys',
				requestId
			},
			{ status: 500 }
		);
	}
};
