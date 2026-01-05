import DOMPurify from 'dompurify';

/**
 * XSS Prevention utilities using DOMPurify
 *
 * Security Notes:
 * - All user-generated content MUST be sanitized before rendering
 * - Use sanitizeHtml() for content that may contain HTML
 * - Use escapeText() for plain text that should never contain HTML
 * - Configure allowlist based on your content requirements
 */

/**
 * Allowed HTML tags for user content
 * Keep this list minimal - only what's absolutely necessary
 */
const ALLOWED_TAGS = [
	'b',
	'i',
	'em',
	'strong',
	'a',
	'p',
	'br',
	'ul',
	'ol',
	'li',
	'code',
	'pre',
	'blockquote',
	'span'
] as const;

/**
 * Allowed HTML attributes
 * href is allowed for links, but will be sanitized
 */
const ALLOWED_ATTR = ['href', 'title', 'class', 'id'] as const;

/**
 * Allowed URI schemes for href attributes
 * Prevents javascript: and data: URI attacks
 */
const ALLOWED_URI_REGEXP =
	/^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

/**
 * DOMPurify configuration for sanitizing HTML content
 */
const SANITIZE_CONFIG = {
	ALLOWED_TAGS: [...ALLOWED_TAGS],
	ALLOWED_ATTR: [...ALLOWED_ATTR],
	ALLOWED_URI_REGEXP,
	KEEP_CONTENT: true,
	RETURN_DOM: false,
	RETURN_DOM_FRAGMENT: false,
	RETURN_TRUSTED_TYPE: false as const,
	SANITIZE_DOM: true,
	WHOLE_DOCUMENT: false,
	FORCE_BODY: false,
	ADD_TAGS: [] as string[],
	ADD_ATTR: [] as string[],
	FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
	FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus']
};

/**
 * Strict configuration that removes all HTML
 */
const STRICT_CONFIG = {
	ALLOWED_TAGS: [] as string[],
	ALLOWED_ATTR: [] as string[],
	KEEP_CONTENT: true,
	RETURN_TRUSTED_TYPE: false as const
};

/**
 * Sanitizes HTML content, allowing only safe tags and attributes
 *
 * @param dirty - The untrusted HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * sanitizeHtml('<script>alert("xss")</script><p>Hello</p>')
 * // Returns: '<p>Hello</p>'
 *
 * sanitizeHtml('<a href="javascript:alert(1)">Click</a>')
 * // Returns: '<a>Click</a>'
 */
export function sanitizeHtml(dirty: string): string {
	if (!dirty || typeof dirty !== 'string') {
		return '';
	}
	return DOMPurify.sanitize(dirty, SANITIZE_CONFIG) as string;
}

/**
 * Escapes all HTML, returning only plain text content
 * Use this when HTML should never be rendered
 *
 * @param dirty - The untrusted string to escape
 * @returns Plain text with all HTML removed
 *
 * @example
 * escapeText('<script>alert("xss")</script>Hello')
 * // Returns: 'Hello'
 */
export function escapeText(dirty: string): string {
	if (!dirty || typeof dirty !== 'string') {
		return '';
	}
	return DOMPurify.sanitize(dirty, STRICT_CONFIG) as string;
}

/**
 * Sanitizes a URL, ensuring it uses safe protocols
 *
 * @param url - The untrusted URL to sanitize
 * @returns Safe URL or empty string if invalid
 *
 * @example
 * sanitizeUrl('javascript:alert(1)')
 * // Returns: ''
 *
 * sanitizeUrl('https://example.com')
 * // Returns: 'https://example.com'
 */
export function sanitizeUrl(url: string): string {
	if (!url || typeof url !== 'string') {
		return '';
	}

	const trimmed = url.trim();

	// Check for dangerous protocols
	const dangerous = /^(?:javascript|data|vbscript):/i;
	if (dangerous.test(trimmed)) {
		return '';
	}

	// Ensure the URL is valid
	if (!ALLOWED_URI_REGEXP.test(trimmed)) {
		return '';
	}

	return trimmed;
}

/**
 * Configuration type for custom sanitizers
 */
type SanitizerConfig = {
	ALLOWED_TAGS?: string[];
	ALLOWED_ATTR?: string[];
	FORBID_TAGS?: string[];
	FORBID_ATTR?: string[];
	KEEP_CONTENT?: boolean;
};

/**
 * Creates a sanitizer with custom configuration
 * Use for special cases where default config doesn't fit
 *
 * @param config - DOMPurify configuration overrides
 * @returns Sanitizer function
 *
 * @example
 * const sanitizeMarkdown = createSanitizer({
 *   ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'code', 'pre', 'h1', 'h2', 'h3']
 * });
 */
export function createSanitizer(config: SanitizerConfig): (dirty: string) => string {
	const mergedConfig = {
		...SANITIZE_CONFIG,
		...config,
		RETURN_TRUSTED_TYPE: false as const
	};
	return (dirty: string): string => {
		if (!dirty || typeof dirty !== 'string') {
			return '';
		}
		return DOMPurify.sanitize(dirty, mergedConfig) as string;
	};
}

/**
 * Type guard to check if a value is a string before sanitizing
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Safely sanitizes a value that might not be a string
 *
 * @param value - Any value to sanitize
 * @returns Sanitized string or empty string for non-strings
 */
export function safeSanitize(value: unknown): string {
	if (!isString(value)) {
		return '';
	}
	return escapeText(value);
}
