/**
 * Auth Verification Tests
 *
 * TDD: RED phase - tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyAuth, requireAuth, AuthError } from '../verify';
import { createAccessToken, createRefreshToken, type UserPayload } from '../jwt';
import type { Cookies } from '@sveltejs/kit';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_USER: UserPayload = {
	id: 'test-user-123',
	email: 'test@example.com',
	name: 'Test User',
	roles: ['user']
};

// Mock cookies helper
function createMockCookies(tokens: { access?: string; refresh?: string }): Cookies {
	const cookieStore = new Map<string, string>();
	if (tokens.access) cookieStore.set('gastown_access', tokens.access);
	if (tokens.refresh) cookieStore.set('gastown_refresh', tokens.refresh);

	return {
		get: (name: string) => cookieStore.get(name) ?? null,
		getAll: () => Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn()
	} as unknown as Cookies;
}

// =============================================================================
// AuthError Tests
// =============================================================================

describe('AuthError', () => {
	it('has correct name', () => {
		const err = new AuthError('test', 'NO_TOKEN');
		expect(err.name).toBe('AuthError');
	});

	it('has correct message', () => {
		const err = new AuthError('Authentication required', 'NO_TOKEN');
		expect(err.message).toBe('Authentication required');
	});

	it('has correct code', () => {
		const err = new AuthError('test', 'INVALID_TOKEN');
		expect(err.code).toBe('INVALID_TOKEN');
	});

	it('is instanceof Error and AuthError', () => {
		const err = new AuthError('test', 'EXPIRED_TOKEN');
		// Check prototype chain properly
		expect(Object.getPrototypeOf(err).constructor.name).toBe('AuthError');
		expect(err.name).toBe('AuthError');
		expect(err instanceof Error).toBe(true);
		expect(err instanceof AuthError).toBe(true);
	});
});

// =============================================================================
// verifyAuth Tests
// =============================================================================

describe('verifyAuth', () => {
	it('returns valid result with user for valid token', async () => {
		const accessToken = await createAccessToken(TEST_USER);
		const cookies = createMockCookies({ access: accessToken });

		const result = await verifyAuth(cookies);

		expect(result.valid).toBe(true);
		expect(result.user).toMatchObject({
			id: TEST_USER.id,
			email: TEST_USER.email,
			name: TEST_USER.name
		});
	});

	it('returns invalid result when no token present', async () => {
		const cookies = createMockCookies({});

		const result = await verifyAuth(cookies);

		expect(result.valid).toBe(false);
		expect(result.user).toBeUndefined();
		expect(result.error).toBe('NO_TOKEN');
	});

	it('returns invalid result for malformed token', async () => {
		const cookies = createMockCookies({ access: 'not-a-valid-jwt' });

		const result = await verifyAuth(cookies);

		expect(result.valid).toBe(false);
		expect(result.user).toBeUndefined();
		expect(result.error).toBe('INVALID_TOKEN');
	});

	it('returns invalid result for expired token', async () => {
		// Create a token that's already expired
		const expiredToken = await createExpiredToken(TEST_USER);
		const cookies = createMockCookies({ access: expiredToken });

		const result = await verifyAuth(cookies);

		expect(result.valid).toBe(false);
		expect(result.error).toBe('EXPIRED_TOKEN');
	});

	it('returns invalid result for refresh token used as access token', async () => {
		const refreshToken = await createRefreshToken(TEST_USER.id);
		const cookies = createMockCookies({ access: refreshToken });

		const result = await verifyAuth(cookies);

		expect(result.valid).toBe(false);
		expect(result.error).toBe('INVALID_TOKEN');
	});
});

// =============================================================================
// requireAuth Tests
// =============================================================================

describe('requireAuth', () => {
	it('returns user for valid token', async () => {
		const accessToken = await createAccessToken(TEST_USER);
		const cookies = createMockCookies({ access: accessToken });

		const user = await requireAuth(cookies);

		expect(user.id).toBe(TEST_USER.id);
		expect(user.email).toBe(TEST_USER.email);
	});

	it('throws AuthError with NO_TOKEN code when no token', async () => {
		const cookies = createMockCookies({});

		await expect(requireAuth(cookies)).rejects.toThrow(AuthError);
		await expect(requireAuth(cookies)).rejects.toMatchObject({
			code: 'NO_TOKEN'
		});
	});

	it('throws AuthError with INVALID_TOKEN code for malformed token', async () => {
		const cookies = createMockCookies({ access: 'bad-token' });

		await expect(requireAuth(cookies)).rejects.toThrow(AuthError);
		await expect(requireAuth(cookies)).rejects.toMatchObject({
			code: 'INVALID_TOKEN'
		});
	});

	it('throws AuthError with EXPIRED_TOKEN code for expired token', async () => {
		const expiredToken = await createExpiredToken(TEST_USER);
		const cookies = createMockCookies({ access: expiredToken });

		await expect(requireAuth(cookies)).rejects.toThrow(AuthError);
		await expect(requireAuth(cookies)).rejects.toMatchObject({
			code: 'EXPIRED_TOKEN'
		});
	});
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a token that's already expired (for testing)
 */
async function createExpiredToken(user: UserPayload): Promise<string> {
	// Import jose directly to create a custom expired token
	const { SignJWT } = await import('jose');
	const secret = new TextEncoder().encode(
		process.env.AUTH_SECRET || 'gastown-dev-secret-do-not-use-in-production'
	);
	const now = Math.floor(Date.now() / 1000);

	return new SignJWT({
		email: user.email,
		name: user.name,
		roles: user.roles || ['user'],
		type: 'access'
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setIssuer('gastown-ui')
		.setAudience('gastown')
		.setIssuedAt(now - 3600) // 1 hour ago
		.setExpirationTime(now - 1800) // Expired 30 min ago
		.sign(secret);
}
