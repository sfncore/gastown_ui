/**
 * Login API Endpoint
 *
 * POST /api/auth/login
 * Authenticates user and sets secure HttpOnly cookies
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setAuthCookies } from '$lib/auth/cookies';
import type { AuthResponse, LoginCredentials } from '$lib/auth/types';

/** Access token expiry: 15 minutes */
const ACCESS_TOKEN_EXPIRY = 15 * 60;

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Mock authentication - replace with your actual auth backend
 * In production, this would call your authentication service
 */
async function authenticateUser(credentials: LoginCredentials): Promise<{
	success: boolean;
	user?: { id: string; email: string; name?: string; roles?: string[] };
	accessToken?: string;
	refreshToken?: string;
	error?: string;
}> {
	// TODO: Replace with actual authentication logic
	// This is a placeholder that demonstrates the expected interface

	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Demo: Accept any email with password "demo"
	if (credentials.password === 'demo') {
		const userId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		// Create mock JWT tokens (in production, use proper JWT library)
		const accessPayload = {
			sub: userId,
			email: credentials.email,
			name: credentials.email.split('@')[0],
			roles: ['user'],
			iat: now,
			exp: now + ACCESS_TOKEN_EXPIRY
		};

		const refreshPayload = {
			sub: userId,
			type: 'refresh',
			iat: now,
			exp: now + REFRESH_TOKEN_EXPIRY
		};

		// Base64 encode (not a real JWT - just for demo)
		const accessToken = `demo.${btoa(JSON.stringify(accessPayload))}.sig`;
		const refreshToken = `demo.${btoa(JSON.stringify(refreshPayload))}.sig`;

		return {
			success: true,
			user: {
				id: userId,
				email: credentials.email,
				name: credentials.email.split('@')[0],
				roles: ['user']
			},
			accessToken,
			refreshToken
		};
	}

	return {
		success: false,
		error: 'Invalid credentials'
	};
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const credentials: LoginCredentials = {
			email: body.email,
			password: body.password
		};

		// Validate input
		if (!credentials.email || !credentials.password) {
			const response: AuthResponse = { success: false, error: 'Email and password are required' };
			return json(response, { status: 400 });
		}

		// Authenticate
		const result = await authenticateUser(credentials);

		if (!result.success || !result.user || !result.accessToken || !result.refreshToken) {
			const response: AuthResponse = { success: false, error: result.error ?? 'Authentication failed' };
			return json(response, { status: 401 });
		}

		// Set secure cookies
		setAuthCookies(
			cookies,
			result.accessToken,
			result.refreshToken,
			ACCESS_TOKEN_EXPIRY,
			REFRESH_TOKEN_EXPIRY
		);

		const expiresAt = Date.now() + (ACCESS_TOKEN_EXPIRY * 1000);

		const response: AuthResponse = {
			success: true,
			user: result.user,
			expiresAt
		};
		return json(response);
	} catch (error) {
		console.error('Login error:', error);
		const response: AuthResponse = { success: false, error: 'Login failed' };
		return json(response, { status: 500 });
	}
};
