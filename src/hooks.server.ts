import type { Handle } from '@sveltejs/kit';

const CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	"connect-src 'self' wss:",
	"img-src 'self' data:",
	"font-src 'self'",
	"frame-ancestors 'none'"
].join('; ');

const securityHeaders = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const hstsHeader = {
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Apply CSP
	response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);

	// Apply security headers
	for (const [key, value] of Object.entries(securityHeaders)) {
		response.headers.set(key, value);
	}

	// Apply HSTS only in production
	if (import.meta.env.PROD) {
		for (const [key, value] of Object.entries(hstsHeader)) {
			response.headers.set(key, value);
		}
	}

	return response;
};
