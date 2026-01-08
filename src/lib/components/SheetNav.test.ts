/**
 * SheetNav Component Tests
 *
 * Tests for rendering, grouping, interactions, and accessibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SheetNav from './SheetNav.svelte';

const baseItems = [
	{ id: 'alpha', label: 'Alpha', href: '/alpha', section: 'Primary' },
	{ id: 'beta', label: 'Beta', href: '/beta' },
	{ id: 'gamma', label: 'Gamma', href: '/gamma', badge: 120, description: 'More info' }
];

describe('SheetNav', () => {
	describe('Rendering', () => {
		it('does not render when closed', () => {
			render(SheetNav, { props: { open: false, items: baseItems } });
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});

		it('renders title and subtitle based on item count', () => {
			render(SheetNav, { props: { open: true, title: 'Routes', items: baseItems } });
			expect(screen.getByRole('dialog', { name: 'Routes' })).toBeInTheDocument();
			expect(screen.getByText('3 destinations')).toBeInTheDocument();
		});

		it('renders empty state when no items are provided', () => {
			render(SheetNav, { props: { open: true, items: [] } });
			expect(screen.getByText('No destinations yet.')).toBeInTheDocument();
		});
	});

	describe('Grouping', () => {
		it('groups items by section with default label', () => {
			render(SheetNav, { props: { open: true, items: baseItems } });
			expect(screen.getByText('Primary')).toBeInTheDocument();
			expect(screen.getByText('Destinations')).toBeInTheDocument();
		});
	});

	describe('Active State', () => {
		it('marks the active item with aria-current', () => {
			render(SheetNav, { props: { open: true, items: baseItems, activeId: 'beta' } });
			const activeLink = screen.getByRole('link', { name: 'Beta' });
			expect(activeLink).toHaveAttribute('aria-current', 'page');
		});
	});

	describe('Badges', () => {
		it('caps numeric badges over 99', () => {
			render(SheetNav, { props: { open: true, items: baseItems } });
			expect(screen.getByText('99+')).toBeInTheDocument();
		});
	});

	describe('Interactions', () => {
		it('calls onItemSelect and onClose when an item is clicked', async () => {
			const handleSelect = vi.fn();
			const handleClose = vi.fn();
			render(SheetNav, {
				props: { open: true, items: baseItems, onItemSelect: handleSelect, onClose: handleClose }
			});

			const link = screen.getByRole('link', { name: 'Alpha' });
			await fireEvent.click(link);

			expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'alpha' }));
			expect(handleClose).toHaveBeenCalledTimes(1);
		});

		it('closes when the backdrop is clicked', async () => {
			const handleClose = vi.fn();
			render(SheetNav, { props: { open: true, items: baseItems, onClose: handleClose } });

			const [backdrop] = screen.getAllByRole('button', { name: /close navigation sheet/i });
			await fireEvent.click(backdrop);

			expect(handleClose).toHaveBeenCalledTimes(1);
		});

		it('closes on Escape key', async () => {
			const handleClose = vi.fn();
			render(SheetNav, { props: { open: true, items: baseItems, onClose: handleClose } });

			const dialog = screen.getByRole('dialog');
			await fireEvent.keyDown(dialog, { key: 'Escape' });

			expect(handleClose).toHaveBeenCalledTimes(1);
		});
	});
});
