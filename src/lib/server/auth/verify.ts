/**
 * Auth Verification Utilities
 *
 * Provides route guard helpers for verifying JWT tokens from cookies.
 * YELLOW phase: Minimal implementation to pass tests.
 */

import type { Cookies } from '@sveltejs/kit';
import { verifyToken, extractUserFromPayload, type UserPayload } from './jwt';

/** Auth error codes */
export type AuthErrorCode = 'NO_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN';

/**
 * Authentication error with typed code
 */
export class AuthError extends Error {
	constructor(
		message: string,
		public readonly code: AuthErrorCode
	) {
		super(message);
		this.name = 'AuthError';
	}
}

/** Result from verifyAuth */
export interface AuthResult {
	valid: boolean;
	user?: UserPayload;
	error?: AuthErrorCode;
}

/** Cookie name for access token */
const ACCESS_TOKEN_COOKIE = 'gastown_access';

/**
 * Verify authentication from cookies
 * Returns a result object indicating validity
 */
export async function verifyAuth(cookies: Cookies): Promise<AuthResult> {
	const token = cookies.get(ACCESS_TOKEN_COOKIE);

	if (!token) {
		return { valid: false, error: 'NO_TOKEN' };
	}

	const payload = await verifyToken(token, 'access');

	if (!payload) {
		// Determine if expired or invalid by checking token structure
		const isExpired = await checkIfExpired(token);
		return { valid: false, error: isExpired ? 'EXPIRED_TOKEN' : 'INVALID_TOKEN' };
	}

	const user = extractUserFromPayload(payload);
	if (!user) {
		return { valid: false, error: 'INVALID_TOKEN' };
	}

	return { valid: true, user };
}

/**
 * Require authentication - throws if not authenticated
 * Use this in route guards
 */
export async function requireAuth(cookies: Cookies): Promise<UserPayload> {
	const result = await verifyAuth(cookies);

	if (!result.valid || !result.user) {
		throw new AuthError(
			getErrorMessage(result.error || 'INVALID_TOKEN'),
			result.error || 'INVALID_TOKEN'
		);
	}

	return result.user;
}

/**
 * Check if a token is expired (vs malformed)
 */
async function checkIfExpired(token: string): Promise<boolean> {
	try {
		// Try to decode the payload without verification
		const parts = token.split('.');
		if (parts.length !== 3) return false;

		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
		const now = Math.floor(Date.now() / 1000);

		return payload.exp && payload.exp < now;
	} catch {
		return false;
	}
}

/**
 * Get human-readable error message for auth error code
 */
function getErrorMessage(code: AuthErrorCode): string {
	switch (code) {
		case 'NO_TOKEN':
			return 'Authentication required';
		case 'INVALID_TOKEN':
			return 'Invalid authentication token';
		case 'EXPIRED_TOKEN':
			return 'Authentication token has expired';
	}
}
