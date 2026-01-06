/**
 * Toast Component Tests
 *
 * Tests for Toast type variants, dismiss functionality, and accessibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Toast from './Toast.svelte';

describe('Toast', () => {
	describe('Basic Rendering', () => {
		it('renders with message', () => {
			render(Toast, { props: { id: 'test-1', message: 'Test notification' } });
			expect(screen.getByText('Test notification')).toBeInTheDocument();
		});

		it('renders as an alert', () => {
			render(Toast, { props: { id: 'test-1', message: 'Alert message' } });
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});

		it('renders dismiss button by default', () => {
			render(Toast, { props: { id: 'test-1', message: 'Dismissible' } });
			expect(
				screen.getByRole('button', { name: /dismiss notification/i })
			).toBeInTheDocument();
		});

		it('does not render dismiss button when dismissible is false', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Not dismissible', dismissible: false }
			});
			expect(screen.queryByRole('button')).not.toBeInTheDocument();
		});
	});

	describe('Type Variants', () => {
		it('renders info type by default', () => {
			render(Toast, { props: { id: 'test-1', message: 'Info message' } });
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('bg-info/90');
		});

		it('renders success type', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Success message', type: 'success' }
			});
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('bg-success/90');
		});

		it('renders warning type', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Warning message', type: 'warning' }
			});
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('bg-warning/90');
		});

		it('renders error type', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Error message', type: 'error' }
			});
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('bg-destructive/90');
		});
	});

	describe('Dismiss Functionality', () => {
		it('calls onDismiss when dismiss button is clicked', async () => {
			const handleDismiss = vi.fn();
			render(Toast, {
				props: { id: 'test-1', message: 'Test', onDismiss: handleDismiss }
			});
			const dismissButton = screen.getByRole('button', {
				name: /dismiss notification/i
			});
			await fireEvent.click(dismissButton);
			expect(handleDismiss).toHaveBeenCalledWith('test-1');
		});

		it('passes correct id to onDismiss callback', async () => {
			const handleDismiss = vi.fn();
			render(Toast, {
				props: { id: 'unique-id-123', message: 'Test', onDismiss: handleDismiss }
			});
			const dismissButton = screen.getByRole('button', {
				name: /dismiss notification/i
			});
			await fireEvent.click(dismissButton);
			expect(handleDismiss).toHaveBeenCalledWith('unique-id-123');
		});
	});

	describe('Accessibility', () => {
		it('has aria-live="polite" for non-error toasts', () => {
			render(Toast, { props: { id: 'test-1', message: 'Info', type: 'info' } });
			expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
		});

		it('has aria-live="assertive" for error toasts', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Error', type: 'error' }
			});
			expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
		});

		it('has aria-live="polite" for success toasts', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Success', type: 'success' }
			});
			expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
		});

		it('has aria-live="polite" for warning toasts', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Warning', type: 'warning' }
			});
			expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
		});

		it('dismiss button has accessible label', () => {
			render(Toast, { props: { id: 'test-1', message: 'Test' } });
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('aria-label', 'Dismiss notification');
		});

		it('icon is hidden from screen readers', () => {
			const { container } = render(Toast, {
				props: { id: 'test-1', message: 'Test' }
			});
			const icons = container.querySelectorAll('svg[aria-hidden="true"]');
			expect(icons.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Custom Classes', () => {
		it('accepts custom class names', () => {
			render(Toast, {
				props: { id: 'test-1', message: 'Test', class: 'my-custom-class' }
			});
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('my-custom-class');
		});
	});

	describe('Animation', () => {
		it('has slide-in animation class', () => {
			render(Toast, { props: { id: 'test-1', message: 'Test' } });
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('animate-slide-in-down');
		});
	});

	describe('Layout', () => {
		it('has flex layout', () => {
			render(Toast, { props: { id: 'test-1', message: 'Test' } });
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('flex');
			expect(alert).toHaveClass('items-center');
		});

		it('has proper sizing constraints', () => {
			render(Toast, { props: { id: 'test-1', message: 'Test' } });
			const alert = screen.getByRole('alert');
			expect(alert).toHaveClass('min-w-[280px]');
			expect(alert).toHaveClass('max-w-[400px]');
		});
	});
});
