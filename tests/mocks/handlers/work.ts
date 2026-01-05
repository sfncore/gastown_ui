/**
 * Work API Handlers
 *
 * MSW handlers for issues, convoys, and work management
 */

import { http, HttpResponse, delay } from 'msw';
import {
	mockIssues,
	mockConvoys,
	mockEmptyIssues,
	mockEmptyConvoys,
	getIssueById,
	getConvoyById,
	mockSlingResponse,
	mockSlingErrorResponse
} from '../fixtures/work';

/** Simulated network delay (ms) */
const NETWORK_DELAY = 100;

/** State for simulating different scenarios */
export const workState = {
	shouldFail: false,
	useEmptyData: false,
	slingSuccess: true,
	errorMessage: 'Failed to fetch work items'
};

export const workHandlers = [
	/**
	 * GET /api/gastown/work/issues
	 * Returns list of issues with optional filters
	 */
	http.get('/api/gastown/work/issues', async ({ request }) => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail) {
			return HttpResponse.json(
				{ error: workState.errorMessage },
				{ status: 500 }
			);
		}

		if (workState.useEmptyData) {
			return HttpResponse.json(mockEmptyIssues);
		}

		// Parse query params for filtering
		const url = new URL(request.url);
		const status = url.searchParams.get('status');
		const type = url.searchParams.get('type');
		const assignee = url.searchParams.get('assignee');

		let filtered = [...mockIssues];

		if (status) {
			filtered = filtered.filter((issue) => issue.status === status);
		}
		if (type) {
			filtered = filtered.filter((issue) => issue.type === type);
		}
		if (assignee) {
			filtered = filtered.filter((issue) => issue.assignee === assignee);
		}

		return HttpResponse.json(filtered);
	}),

	/**
	 * GET /api/gastown/work/issues/:id
	 * Returns a specific issue by ID
	 */
	http.get('/api/gastown/work/issues/:id', async ({ params }) => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail) {
			return HttpResponse.json(
				{ error: workState.errorMessage },
				{ status: 500 }
			);
		}

		const issue = getIssueById(params.id as string);

		if (!issue) {
			return HttpResponse.json(
				{ error: 'Issue not found' },
				{ status: 404 }
			);
		}

		return HttpResponse.json(issue);
	}),

	/**
	 * GET /api/gastown/convoys
	 * Returns list of convoys
	 */
	http.get('/api/gastown/convoys', async () => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch convoys' },
				{ status: 500 }
			);
		}

		if (workState.useEmptyData) {
			return HttpResponse.json(mockEmptyConvoys);
		}

		return HttpResponse.json(mockConvoys);
	}),

	/**
	 * GET /api/gastown/work/convoys
	 * Alias for convoys endpoint
	 */
	http.get('/api/gastown/work/convoys', async () => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch convoys' },
				{ status: 500 }
			);
		}

		if (workState.useEmptyData) {
			return HttpResponse.json(mockEmptyConvoys);
		}

		return HttpResponse.json(mockConvoys);
	}),

	/**
	 * GET /api/gastown/work/convoys/:id
	 * Returns a specific convoy by ID
	 */
	http.get('/api/gastown/work/convoys/:id', async ({ params }) => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch convoy' },
				{ status: 500 }
			);
		}

		const convoy = getConvoyById(params.id as string);

		if (!convoy) {
			return HttpResponse.json(
				{ error: 'Convoy not found' },
				{ status: 404 }
			);
		}

		return HttpResponse.json(convoy);
	}),

	/**
	 * POST /api/gastown/work/sling
	 * Assigns work to a rig/polecat
	 */
	http.post('/api/gastown/work/sling', async ({ request }) => {
		await delay(NETWORK_DELAY);

		if (workState.shouldFail || !workState.slingSuccess) {
			return HttpResponse.json(mockSlingErrorResponse, { status: 400 });
		}

		const body = await request.json() as { issue?: string; rig?: string };

		if (!body.issue || !body.rig) {
			return HttpResponse.json(
				{ error: 'Issue ID and rig name are required' },
				{ status: 400 }
			);
		}

		return HttpResponse.json(mockSlingResponse);
	})
];
