/**
 * Auth API Fixtures
 *
 * Mock data for authentication endpoints
 */

import type { AuthResponse } from '$lib/auth/types';

/** Mock user data */
export const mockUser = {
	id: 'user-123',
	email: 'demo@gastown.dev',
	name: 'Demo User',
	roles: ['user', 'admin']
};

/** Mock JWT payload (base64 encoded) */
function createMockJwt(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body = btoa(JSON.stringify(payload));
	return `${header}.${body}.mock-signature`;
}

/** Mock access token (15 min expiry) */
export const mockAccessToken = createMockJwt({
	sub: mockUser.id,
	email: mockUser.email,
	name: mockUser.name,
	roles: mockUser.roles,
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 900
});

/** Mock refresh token (7 day expiry) */
export const mockRefreshToken = createMockJwt({
	sub: mockUser.id,
	type: 'refresh',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 604800
});

/** Successful login response */
export const loginSuccessResponse: AuthResponse = {
	success: true,
	user: mockUser,
	expiresAt: Date.now() + 900000
};

/** Failed login response */
export const loginFailureResponse: AuthResponse = {
	success: false,
	error: 'Invalid credentials'
};

/** Current user response */
export const meResponse = {
	user: mockUser,
	authenticated: true
};

/** Logout response */
export const logoutResponse: AuthResponse = {
	success: true
};

/** Refresh token response */
export const refreshResponse: AuthResponse = {
	success: true,
	user: mockUser,
	expiresAt: Date.now() + 900000
};

/** Expired session response */
export const sessionExpiredResponse: AuthResponse = {
	success: false,
	error: 'Session expired'
};
