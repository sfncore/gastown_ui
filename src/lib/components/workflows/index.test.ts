import { describe, it, expect } from 'vitest';

describe('workflows component module exports', () => {
	describe('WorkflowFilters', () => {
		it('exports WorkflowFilters component with correct path reference', async () => {
			const module = await import('./index');
			// In test environment, Svelte components are exported as string paths
			// Verify the export is a string containing the component path
			expect(typeof module.WorkflowFilters).toBe('string');
			expect(module.WorkflowFilters).toMatch(/WorkflowFilters\.svelte/);
		});
	});

	describe('WorkflowList', () => {
		it('exports WorkflowList component with correct path reference', async () => {
			const module = await import('./index');
			expect(typeof module.WorkflowList).toBe('string');
			expect(module.WorkflowList).toMatch(/WorkflowList\.svelte/);
		});
	});

	describe('WorkflowDetail', () => {
		it('exports WorkflowDetail component with correct path reference', async () => {
			const module = await import('./index');
			expect(typeof module.WorkflowDetail).toBe('string');
			expect(module.WorkflowDetail).toMatch(/WorkflowDetail\.svelte/);
		});
	});

	describe('type exports', () => {
		it('exports types module with no runtime values (type-only exports)', async () => {
			// Type-only exports don't exist at runtime, verify module loads cleanly
			const module = await import('./types');
			expect(Object.keys(module)).toEqual([]);
		});

		it('re-exports components from index with correct structure', async () => {
			// Verify index module exports the expected component keys
			const indexModule = await import('./index');
			const exportKeys = Object.keys(indexModule);
			expect(exportKeys).toContain('WorkflowFilters');
			expect(exportKeys).toContain('WorkflowList');
			expect(exportKeys).toContain('WorkflowDetail');
			expect(exportKeys.length).toBeGreaterThanOrEqual(3);
		});
	});
});
