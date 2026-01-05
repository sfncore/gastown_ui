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

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return response;
};
