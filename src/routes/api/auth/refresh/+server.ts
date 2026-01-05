/**
 * Token Refresh API Endpoint
 *
 * POST /api/auth/refresh
 * Refreshes access token before expiration using refresh token
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRefreshToken, setAuthCookies, clearAuthCookies } from '$lib/auth/cookies';
import type { AuthResponse } from '$lib/auth/types';

/** Access token expiry: 15 minutes */
const ACCESS_TOKEN_EXPIRY = 15 * 60;

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Mock token refresh - replace with your actual auth backend
 * In production, this would validate the refresh token and issue new tokens
 */
async function refreshTokens(refreshToken: string): Promise<{
	success: boolean;
	accessToken?: string;
	newRefreshToken?: string;
	error?: string;
}> {
	// TODO: Replace with actual token refresh logic
	// This is a placeholder that demonstrates the expected interface

	try {
		// Parse the mock refresh token to get user ID
		const parts = refreshToken.split('.');
		if (parts.length !== 3 || parts[0] !== 'demo') {
			return { success: false, error: 'Invalid refresh token' };
		}

		const payload = JSON.parse(atob(parts[1]));

		// Check if refresh token is expired
		if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
			return { success: false, error: 'Refresh token expired' };
		}

		// Check if it's actually a refresh token
		if (payload.type !== 'refresh') {
			return { success: false, error: 'Invalid token type' };
		}

		const now = Math.floor(Date.now() / 1000);

		// Create new tokens
		const accessPayload = {
			sub: payload.sub,
			email: `user-${payload.sub.slice(0, 8)}@example.com`, // Mock email
			roles: ['user'],
			iat: now,
			exp: now + ACCESS_TOKEN_EXPIRY
		};

		const refreshPayload = {
			sub: payload.sub,
			type: 'refresh',
			iat: now,
			exp: now + REFRESH_TOKEN_EXPIRY
		};

		const accessToken = `demo.${btoa(JSON.stringify(accessPayload))}.sig`;
		const newRefreshToken = `demo.${btoa(JSON.stringify(refreshPayload))}.sig`;

		return {
			success: true,
			accessToken,
			newRefreshToken
		};
	} catch {
		return { success: false, error: 'Invalid refresh token format' };
	}
}

export const POST: RequestHandler = async ({ cookies }) => {
	const refreshToken = getRefreshToken(cookies);

	if (!refreshToken) {
		const response: AuthResponse = { success: false, error: 'No refresh token' };
		return json(response, { status: 401 });
	}

	const result = await refreshTokens(refreshToken);

	if (!result.success || !result.accessToken || !result.newRefreshToken) {
		// Clear cookies on refresh failure
		clearAuthCookies(cookies);

		const response: AuthResponse = { success: false, error: result.error ?? 'Token refresh failed' };
		return json(response, { status: 401 });
	}

	// Set new cookies
	setAuthCookies(
		cookies,
		result.accessToken,
		result.newRefreshToken,
		ACCESS_TOKEN_EXPIRY,
		REFRESH_TOKEN_EXPIRY
	);

	const expiresAt = Date.now() + (ACCESS_TOKEN_EXPIRY * 1000);

	const response: AuthResponse = { success: true, expiresAt };
	return json(response);
};
