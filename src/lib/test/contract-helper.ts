/**
 * Contract Test Helper
 *
 * Validates Zod schemas against real CLI output fixtures (golden files).
 * This ensures schemas stay in sync with actual CLI behavior.
 *
 * @module contract-helper
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

/**
 * Format Zod validation errors for clear test output
 */
function formatValidationErrors(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.length > 0 ? `at "${issue.path.join('.')}"` : 'at root';
			return `  - ${path}: ${issue.message} (${issue.code})`;
		})
		.join('\n');
}

/**
 * Create contract tests for a CLI command's JSON output
 *
 * @param name - Human-readable name for the contract (e.g., "gt status --json")
 * @param fixtureFile - Filename in fixtures directory (e.g., "gt-status.json")
 * @param schema - Zod schema to validate against
 *
 * @example
 * ```typescript
 * testCLIContract(
 *   'gt status --json',
 *   'gt-status.json',
 *   GtStatusSchema
 * );
 * ```
 */
export function testCLIContract<T>(name: string, fixtureFile: string, schema: z.ZodType<T>): void {
	const fixturePath = resolve(FIXTURES_DIR, fixtureFile);

	describe(`Contract: ${name}`, () => {
		it('fixture file exists', () => {
			expect(existsSync(fixturePath)).toBe(true);
		});

		it('fixture contains valid JSON', () => {
			const content = readFileSync(fixturePath, 'utf-8');
			expect(() => JSON.parse(content)).not.toThrow();
		});

		it('validates fixture against schema', () => {
			const content = readFileSync(fixturePath, 'utf-8');
			const fixture = JSON.parse(content);
			const result = schema.safeParse(fixture);

			if (!result.success) {
				const errorDetails = formatValidationErrors(result.error.issues);
				throw new Error(
					`Schema validation failed for ${name}:\n` +
						`Fixture: ${fixtureFile}\n` +
						`Errors:\n${errorDetails}\n\n` +
						`Fixture preview: ${JSON.stringify(fixture, null, 2).slice(0, 500)}...`
				);
			}

			expect(result.success).toBe(true);
		});

		it('parsed data maintains required fields', () => {
			const content = readFileSync(fixturePath, 'utf-8');
			const fixture = JSON.parse(content);
			const result = schema.safeParse(fixture);

			if (result.success) {
				// Verify parsed data is not empty/null
				expect(result.data).toBeDefined();
				expect(result.data).not.toBeNull();
			}
		});
	});
}

/**
 * Create contract tests for array-type CLI outputs
 *
 * @param name - Human-readable name for the contract
 * @param fixtureFile - Filename in fixtures directory
 * @param itemSchema - Zod schema for individual array items
 * @param options - Additional test options
 *
 * @example
 * ```typescript
 * testCLIArrayContract(
 *   'bd list --json',
 *   'bd-list.json',
 *   BdBeadSchema,
 *   { minItems: 1 }
 * );
 * ```
 */
export function testCLIArrayContract<T>(
	name: string,
	fixtureFile: string,
	itemSchema: z.ZodType<T>,
	options: { minItems?: number } = {}
): void {
	const fixturePath = resolve(FIXTURES_DIR, fixtureFile);
	const { minItems = 0 } = options;

	describe(`Contract: ${name}`, () => {
		it('fixture file exists', () => {
			expect(existsSync(fixturePath)).toBe(true);
		});

		it('fixture contains valid JSON array', () => {
			const content = readFileSync(fixturePath, 'utf-8');
			const parsed = JSON.parse(content);
			expect(Array.isArray(parsed)).toBe(true);
		});

		it(`array has at least ${minItems} items`, () => {
			const content = readFileSync(fixturePath, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed.length).toBeGreaterThanOrEqual(minItems);
		});

		it('validates each item against schema', () => {
			const content = readFileSync(fixturePath, 'utf-8');
			const items = JSON.parse(content) as unknown[];

			const errors: string[] = [];

			items.forEach((item, index) => {
				const result = itemSchema.safeParse(item);
				if (!result.success) {
					errors.push(
						`Item [${index}]: ${formatValidationErrors(result.error.issues)}\n` +
							`  Data: ${JSON.stringify(item, null, 2).slice(0, 200)}...`
					);
				}
			});

			if (errors.length > 0) {
				throw new Error(
					`Schema validation failed for ${name}:\n` +
						`Fixture: ${fixtureFile}\n` +
						`${errors.length}/${items.length} items failed:\n\n` +
						errors.join('\n\n')
				);
			}

			expect(errors).toHaveLength(0);
		});
	});
}

/**
 * Create contract tests for nullable/optional CLI outputs
 * Handles cases where CLI might return null for empty results
 *
 * @param name - Human-readable name for the contract
 * @param fixtureFile - Filename in fixtures directory
 * @param schema - Zod schema (should handle null case)
 */
export function testCLINullableContract<T>(
	name: string,
	fixtureFile: string,
	schema: z.ZodType<T>
): void {
	const fixturePath = resolve(FIXTURES_DIR, fixtureFile);

	describe(`Contract: ${name}`, () => {
		it('fixture file exists', () => {
			expect(existsSync(fixturePath)).toBe(true);
		});

		it('validates fixture (including null case)', () => {
			const content = readFileSync(fixturePath, 'utf-8').trim();

			// Handle "null" string from CLI
			if (content === 'null') {
				expect(true).toBe(true); // null is valid for empty results
				return;
			}

			const fixture = JSON.parse(content);
			const result = schema.safeParse(fixture);

			if (!result.success) {
				const errorDetails = formatValidationErrors(result.error.issues);
				throw new Error(
					`Schema validation failed for ${name}:\n` +
						`Fixture: ${fixtureFile}\n` +
						`Errors:\n${errorDetails}`
				);
			}

			expect(result.success).toBe(true);
		});
	});
}

/**
 * Load a fixture file for manual testing
 */
export function loadFixture<T>(fixtureFile: string): T {
	const fixturePath = resolve(FIXTURES_DIR, fixtureFile);
	const content = readFileSync(fixturePath, 'utf-8');
	return JSON.parse(content) as T;
}

/**
 * Get the fixtures directory path
 */
export function getFixturesDir(): string {
	return FIXTURES_DIR;
}
