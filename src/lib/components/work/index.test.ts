/**
 * Work Components Module Tests
 *
 * Tests for the work components barrel exports including:
 * - WorkFilters
 * - WorkList
 * - WorkCreateForm
 * - WorkSlingForm
 */
import { describe, it, expect } from 'vitest';

describe('Work Components Module Exports', () => {
	describe('WorkFilters', () => {
		it('exports WorkFilters component', async () => {
			const { WorkFilters } = await import('./index');
			expect(WorkFilters).toBeDefined();
		});

		it('exports workFiltersVariants', async () => {
			const { workFiltersVariants } = await import('./index');
			expect(workFiltersVariants).toBeDefined();
			expect(typeof workFiltersVariants).toBe('function');
		});

		it('exports WorkFiltersProps type', async () => {
			// Type-only export, verify module loads without error
			const module = await import('./index');
			expect(module).toBeDefined();
		});
	});

	describe('WorkList', () => {
		it('exports WorkList component', async () => {
			const { WorkList } = await import('./index');
			expect(WorkList).toBeDefined();
		});

		it('exports workListVariants', async () => {
			const { workListVariants } = await import('./index');
			expect(workListVariants).toBeDefined();
			expect(typeof workListVariants).toBe('function');
		});
	});

	describe('WorkCreateForm', () => {
		it('exports WorkCreateForm component', async () => {
			const { WorkCreateForm } = await import('./index');
			expect(WorkCreateForm).toBeDefined();
		});

		it('exports workCreateFormVariants', async () => {
			const { workCreateFormVariants } = await import('./index');
			expect(workCreateFormVariants).toBeDefined();
			expect(typeof workCreateFormVariants).toBe('function');
		});

		it('exports issueSchema validation', async () => {
			const { issueSchema } = await import('./index');
			expect(issueSchema).toBeDefined();
			expect(typeof issueSchema.safeParse).toBe('function');
		});
	});

	describe('WorkSlingForm', () => {
		it('exports WorkSlingForm component', async () => {
			const { WorkSlingForm } = await import('./index');
			expect(WorkSlingForm).toBeDefined();
		});

		it('exports workSlingFormVariants', async () => {
			const { workSlingFormVariants } = await import('./index');
			expect(workSlingFormVariants).toBeDefined();
			expect(typeof workSlingFormVariants).toBe('function');
		});

		it('exports slingSchema validation', async () => {
			const { slingSchema } = await import('./index');
			expect(slingSchema).toBeDefined();
			expect(typeof slingSchema.safeParse).toBe('function');
		});
	});

	describe('Validation Schemas', () => {
		it('issueSchema validates valid issue', async () => {
			const { issueSchema } = await import('./index');
			const result = issueSchema.safeParse({
				title: 'Test Issue',
				type: 'task',
				priority: 2
			});
			expect(result.success).toBe(true);
		});

		it('issueSchema rejects empty title', async () => {
			const { issueSchema } = await import('./index');
			const result = issueSchema.safeParse({
				title: '',
				type: 'task',
				priority: 2
			});
			expect(result.success).toBe(false);
		});

		it('issueSchema rejects title less than 3 chars', async () => {
			const { issueSchema } = await import('./index');
			const result = issueSchema.safeParse({
				title: 'ab',
				type: 'task',
				priority: 2
			});
			expect(result.success).toBe(false);
		});

		it('issueSchema rejects invalid type', async () => {
			const { issueSchema } = await import('./index');
			const result = issueSchema.safeParse({
				title: 'Test Issue',
				type: 'invalid',
				priority: 2
			});
			expect(result.success).toBe(false);
		});

		it('issueSchema rejects priority out of range', async () => {
			const { issueSchema } = await import('./index');
			const result = issueSchema.safeParse({
				title: 'Test Issue',
				type: 'task',
				priority: 5
			});
			expect(result.success).toBe(false);
		});

		it('slingSchema validates valid sling', async () => {
			const { slingSchema } = await import('./index');
			const result = slingSchema.safeParse({
				issue: 'bd-123',
				rig: 'gastownui'
			});
			expect(result.success).toBe(true);
		});

		it('slingSchema rejects empty issue', async () => {
			const { slingSchema } = await import('./index');
			const result = slingSchema.safeParse({
				issue: '',
				rig: 'gastownui'
			});
			expect(result.success).toBe(false);
		});

		it('slingSchema rejects empty rig', async () => {
			const { slingSchema } = await import('./index');
			const result = slingSchema.safeParse({
				issue: 'bd-123',
				rig: ''
			});
			expect(result.success).toBe(false);
		});
	});
});
