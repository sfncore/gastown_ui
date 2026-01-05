/**
 * Gas Town API Handlers
 *
 * MSW handlers for Gas Town status, rigs, and agents
 */

import { http, HttpResponse, delay } from 'msw';
import {
	mockGasTownStatus,
	mockEmptyStatus,
	mockRigList
} from '../fixtures/gastown';

/** Simulated network delay (ms) */
const NETWORK_DELAY = 100;

/** State for simulating different scenarios */
export const gasTownState = {
	shouldFail: false,
	useEmptyStatus: false,
	errorMessage: 'Failed to fetch status'
};

export const gasTownHandlers = [
	/**
	 * GET /api/gastown/status
	 * Returns full Gas Town status including all rigs and agents
	 */
	http.get('/api/gastown/status', async () => {
		await delay(NETWORK_DELAY);

		if (gasTownState.shouldFail) {
			return HttpResponse.json(
				{ error: gasTownState.errorMessage },
				{ status: 500 }
			);
		}

		const status = gasTownState.useEmptyStatus ? mockEmptyStatus : mockGasTownStatus;
		return HttpResponse.json(status);
	}),

	/**
	 * GET /api/gastown/rigs
	 * Returns list of all rigs
	 */
	http.get('/api/gastown/rigs', async () => {
		await delay(NETWORK_DELAY);

		if (gasTownState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch rigs' },
				{ status: 500 }
			);
		}

		if (gasTownState.useEmptyStatus) {
			return HttpResponse.json([]);
		}

		return HttpResponse.json(mockRigList);
	})
];
