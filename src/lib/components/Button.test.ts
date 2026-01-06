/**
 * Button Component Tests
 *
 * Tests for Button variants, sizes, states, and accessibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
	describe('Variants', () => {
		it('renders primary variant by default', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('bg-primary');
		});

		it('renders secondary variant', () => {
			render(Button, { props: { variant: 'secondary' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('bg-secondary');
		});

		it('renders danger variant', () => {
			render(Button, { props: { variant: 'danger' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('bg-destructive');
		});

		it('renders ghost variant', () => {
			render(Button, { props: { variant: 'ghost' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('bg-transparent');
		});
	});

	describe('Sizes', () => {
		it('renders small size', () => {
			render(Button, { props: { size: 'sm' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('h-9');
		});

		it('renders medium size by default', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('h-10');
		});

		it('renders large size', () => {
			render(Button, { props: { size: 'lg' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('h-12');
		});
	});

	describe('States', () => {
		it('is not disabled by default', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).not.toBeDisabled();
		});

		it('can be disabled', () => {
			render(Button, { props: { disabled: true } });
			const button = screen.getByRole('button');
			expect(button).toBeDisabled();
			expect(button).toHaveAttribute('aria-disabled', 'true');
		});

		it('shows loading state', () => {
			render(Button, { props: { loading: true } });
			const button = screen.getByRole('button');
			expect(button).toBeDisabled();
			expect(button).toHaveAttribute('aria-busy', 'true');
			expect(button).toHaveAttribute('aria-label', 'Loading...');
		});

		it('is disabled when loading', () => {
			render(Button, { props: { loading: true } });
			const button = screen.getByRole('button');
			expect(button).toBeDisabled();
		});
	});

	describe('Full Width', () => {
		it('is not full width by default', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).not.toHaveClass('w-full');
		});

		it('can be full width', () => {
			render(Button, { props: { fullWidth: true } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('w-full');
		});
	});

	describe('Icon Only', () => {
		it('applies icon-only styling', () => {
			render(Button, { props: { iconOnly: true } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('aspect-square');
		});
	});

	describe('Interactions', () => {
		it('calls onclick handler when clicked', async () => {
			const handleClick = vi.fn();
			render(Button, { props: { onclick: handleClick } });
			const button = screen.getByRole('button');
			await fireEvent.click(button);
			expect(handleClick).toHaveBeenCalledTimes(1);
		});

		it('is disabled when disabled prop is true', () => {
			render(Button, { props: { disabled: true } });
			const button = screen.getByRole('button');
			expect(button).toBeDisabled();
			expect(button).toHaveClass('disabled:pointer-events-none');
		});

		it('is disabled when loading', () => {
			render(Button, { props: { loading: true } });
			const button = screen.getByRole('button');
			expect(button).toBeDisabled();
			expect(button).toHaveClass('disabled:pointer-events-none');
		});
	});

	describe('Accessibility', () => {
		it('has correct button type by default', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('type', 'button');
		});

		it('can set type to submit', () => {
			render(Button, { props: { type: 'submit' } });
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('type', 'submit');
		});

		it('applies custom aria-label', () => {
			render(Button, { props: { 'aria-label': 'Custom label' } });
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('aria-label', 'Custom label');
		});

		it('has focus visible styles', () => {
			render(Button, { props: {} });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('focus-visible:ring-2');
		});
	});

	describe('Custom Classes', () => {
		it('accepts custom class names', () => {
			render(Button, { props: { class: 'my-custom-class' } });
			const button = screen.getByRole('button');
			expect(button).toHaveClass('my-custom-class');
		});
	});
});
