/**
 * Auth API Handlers
 *
 * MSW handlers for authentication endpoints
 */

import { http, HttpResponse, delay } from 'msw';
import {
	loginSuccessResponse,
	loginFailureResponse,
	meResponse,
	logoutResponse,
	refreshResponse,
	sessionExpiredResponse
} from '../fixtures/auth';

/** Simulated network delay (ms) */
const NETWORK_DELAY = 100;

/** State for simulating different scenarios */
export const authState = {
	isAuthenticated: false,
	shouldFail: false,
	shouldExpire: false
};

export const authHandlers = [
	/**
	 * POST /api/auth/login
	 * Authenticates user and returns session
	 */
	http.post('/api/auth/login', async ({ request }) => {
		await delay(NETWORK_DELAY);

		if (authState.shouldFail) {
			return HttpResponse.json(loginFailureResponse, { status: 401 });
		}

		const body = await request.json() as { email?: string; password?: string };

		// Validate credentials (demo mode: password = "demo")
		if (!body.email || !body.password) {
			return HttpResponse.json(
				{ success: false, error: 'Email and password are required' },
				{ status: 400 }
			);
		}

		if (body.password !== 'demo') {
			return HttpResponse.json(loginFailureResponse, { status: 401 });
		}

		authState.isAuthenticated = true;
		return HttpResponse.json(loginSuccessResponse);
	}),

	/**
	 * POST /api/auth/logout
	 * Clears session and returns success
	 */
	http.post('/api/auth/logout', async () => {
		await delay(NETWORK_DELAY);
		authState.isAuthenticated = false;
		return HttpResponse.json(logoutResponse);
	}),

	/**
	 * GET /api/auth/me
	 * Returns current user information
	 */
	http.get('/api/auth/me', async () => {
		await delay(NETWORK_DELAY);

		if (!authState.isAuthenticated) {
			return HttpResponse.json(
				{ user: null, authenticated: false },
				{ status: 401 }
			);
		}

		return HttpResponse.json(meResponse);
	}),

	/**
	 * POST /api/auth/refresh
	 * Refreshes the access token
	 */
	http.post('/api/auth/refresh', async () => {
		await delay(NETWORK_DELAY);

		if (authState.shouldExpire) {
			return HttpResponse.json(sessionExpiredResponse, { status: 401 });
		}

		if (!authState.isAuthenticated) {
			return HttpResponse.json(
				{ success: false, error: 'Not authenticated' },
				{ status: 401 }
			);
		}

		return HttpResponse.json(refreshResponse);
	})
];
