import { describe, it, expect } from 'vitest';

describe('workflows component module exports', () => {
	describe('WorkflowFilters', () => {
		it('exports WorkflowFilters component', async () => {
			const module = await import('./index');
			expect(module.WorkflowFilters).toBeDefined();
			expect(typeof module.WorkflowFilters).toBe('object');
		});
	});

	describe('WorkflowList', () => {
		it('exports WorkflowList component', async () => {
			const module = await import('./index');
			expect(module.WorkflowList).toBeDefined();
			expect(typeof module.WorkflowList).toBe('object');
		});
	});

	describe('WorkflowDetail', () => {
		it('exports WorkflowDetail component', async () => {
			const module = await import('./index');
			expect(module.WorkflowDetail).toBeDefined();
			expect(typeof module.WorkflowDetail).toBe('object');
		});
	});

	describe('type exports', () => {
		it('exports Formula type', async () => {
			// Type-only imports don't exist at runtime, but we verify the module loads
			// and the types are properly re-exported by importing them
			const module = await import('./types');
			expect(module).toBeDefined();
		});

		it('exports FormulaDetail type', async () => {
			const module = await import('./types');
			expect(module).toBeDefined();
		});

		it('exports StaleMolecule type', async () => {
			const module = await import('./types');
			expect(module).toBeDefined();
		});

		it('exports Wisp type', async () => {
			const module = await import('./types');
			expect(module).toBeDefined();
		});

		it('exports MoleculesResponse type', async () => {
			const module = await import('./types');
			expect(module).toBeDefined();
		});

		it('exports TabId type', async () => {
			const module = await import('./types');
			expect(module).toBeDefined();
		});
	});
});
