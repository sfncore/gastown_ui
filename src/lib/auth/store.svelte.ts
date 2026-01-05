/**
 * Authentication Store
 *
 * Client-side reactive auth state using Svelte 5 runes.
 * Works with HttpOnly cookies - tokens are NOT accessible in JS.
 * Uses auth_state cookie to track authentication status.
 */

import { browser } from '$app/environment';
import type { AuthState, User, LoginCredentials, AuthResponse } from './types';
import { AUTH_COOKIES, parseAuthStateCookie } from './cookies';

/** Default auth state */
const DEFAULT_STATE: AuthState = {
	user: null,
	isAuthenticated: false,
	isLoading: true,
	error: null
};

/** Auth store state */
let state = $state<AuthState>({ ...DEFAULT_STATE });

/** Token refresh timer */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Refresh margin - refresh token 60 seconds before expiry */
const REFRESH_MARGIN_MS = 60 * 1000;

/**
 * Get current auth state (reactive)
 */
export function getAuthState(): AuthState {
	return state;
}

/**
 * Check if user is authenticated (reactive)
 */
export function isAuthenticated(): boolean {
	return state.isAuthenticated;
}

/**
 * Get current user (reactive)
 */
export function getUser(): User | null {
	return state.user;
}

/**
 * Initialize auth state from cookies
 * Called on app startup to restore session
 */
export async function initializeAuth(): Promise<void> {
	if (!browser) return;

	state.isLoading = true;
	state.error = null;

	try {
		// Check auth_state cookie for authentication status
		const authStateCookie = getCookie(AUTH_COOKIES.AUTH_STATE);
		const authState = parseAuthStateCookie(authStateCookie);

		if (authState?.authenticated && authState.expiresAt > Date.now()) {
			// Session appears valid, verify with server
			const response = await fetch('/api/auth/me', {
				credentials: 'include' // Include HttpOnly cookies
			});

			if (response.ok) {
				const data: AuthResponse = await response.json();
				if (data.success && data.user) {
					setAuthenticated(data.user, data.expiresAt);
					return;
				}
			}
		}

		// No valid session
		setUnauthenticated();
	} catch (error) {
		console.error('Auth initialization failed:', error);
		setUnauthenticated();
	}
}

/**
 * Login with credentials
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
	state.isLoading = true;
	state.error = null;

	try {
		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(credentials)
		});

		const data: AuthResponse = await response.json();

		if (data.success && data.user) {
			setAuthenticated(data.user, data.expiresAt);
			return data;
		}

		state.error = data.error ?? 'Login failed';
		state.isLoading = false;
		return data;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Login failed';
		state.error = message;
		state.isLoading = false;
		return { success: false, error: message };
	}
}

/**
 * Logout - clears all tokens
 */
export async function logout(): Promise<void> {
	try {
		await fetch('/api/auth/logout', {
			method: 'POST',
			credentials: 'include'
		});
	} catch {
		// Continue with local logout even if server fails
	}

	// Clear local state
	setUnauthenticated();

	// Clear any cached data
	if (browser && 'caches' in window) {
		try {
			// Clear auth-related cache entries
			const cacheNames = await caches.keys();
			for (const name of cacheNames) {
				if (name.includes('auth') || name.includes('user')) {
					await caches.delete(name);
				}
			}
		} catch {
			// Cache clearing is best-effort
		}
	}
}

/**
 * Refresh access token before expiration
 */
export async function refreshToken(): Promise<boolean> {
	try {
		const response = await fetch('/api/auth/refresh', {
			method: 'POST',
			credentials: 'include'
		});

		if (response.ok) {
			const data: AuthResponse = await response.json();
			if (data.success && data.expiresAt) {
				scheduleTokenRefresh(data.expiresAt);
				return true;
			}
		}

		// Refresh failed - logout
		await logout();
		return false;
	} catch {
		await logout();
		return false;
	}
}

/**
 * Set authenticated state
 */
function setAuthenticated(user: User, expiresAt?: number): void {
	state.user = user;
	state.isAuthenticated = true;
	state.isLoading = false;
	state.error = null;

	if (expiresAt) {
		scheduleTokenRefresh(expiresAt);
	}
}

/**
 * Set unauthenticated state
 */
function setUnauthenticated(): void {
	state.user = null;
	state.isAuthenticated = false;
	state.isLoading = false;
	state.error = null;

	clearRefreshTimer();
}

/**
 * Schedule token refresh before expiration
 */
function scheduleTokenRefresh(expiresAt: number): void {
	clearRefreshTimer();

	const now = Date.now();
	const refreshAt = expiresAt - REFRESH_MARGIN_MS;
	const delay = Math.max(0, refreshAt - now);

	if (delay > 0) {
		refreshTimer = setTimeout(() => {
			refreshToken();
		}, delay);
	} else {
		// Token already needs refresh
		refreshToken();
	}
}

/**
 * Clear the refresh timer
 */
function clearRefreshTimer(): void {
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

/**
 * Get cookie value by name (client-side)
 */
function getCookie(name: string): string | undefined {
	if (!browser) return undefined;

	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) {
		return parts.pop()?.split(';').shift();
	}
	return undefined;
}

/**
 * Create auth store with reactive getters
 */
export function createAuthStore() {
	return {
		get state() { return state; },
		get user() { return state.user; },
		get isAuthenticated() { return state.isAuthenticated; },
		get isLoading() { return state.isLoading; },
		get error() { return state.error; },
		initialize: initializeAuth,
		login,
		logout,
		refresh: refreshToken
	};
}
