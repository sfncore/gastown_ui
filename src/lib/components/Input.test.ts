/**
 * Input Component Tests
 *
 * Tests for Input validation states, password toggle, and accessibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input', () => {
	describe('Basic Rendering', () => {
		it('renders an input element', () => {
			render(Input, { props: {} });
			expect(screen.getByRole('textbox')).toBeInTheDocument();
		});

		it('renders with placeholder', () => {
			render(Input, { props: { placeholder: 'Enter text' } });
			expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
		});

		it('renders with label', () => {
			render(Input, { props: { label: 'Username' } });
			expect(screen.getByLabelText('Username')).toBeInTheDocument();
		});

		it('renders with helper text', () => {
			render(Input, { props: { helperText: 'This is helper text' } });
			expect(screen.getByText('This is helper text')).toBeInTheDocument();
		});
	});

	describe('Validation States', () => {
		it('shows error state', () => {
			render(Input, { props: { validationState: 'error' } });
			// The container div with border classes wraps the input directly
			const input = screen.getByRole('textbox');
			const container = input.closest('div');
			expect(container).toHaveClass('border-destructive');
		});

		it('shows error message', () => {
			render(Input, { props: { errorMessage: 'This field is required' } });
			expect(screen.getByText('This field is required')).toBeInTheDocument();
		});

		it('error message takes precedence over helper text', () => {
			render(Input, {
				props: {
					helperText: 'Helper text',
					errorMessage: 'Error message'
				}
			});
			expect(screen.getByText('Error message')).toBeInTheDocument();
			expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
		});

		it('shows success state', () => {
			render(Input, { props: { validationState: 'success' } });
			// The container div with border classes wraps the input directly
			const input = screen.getByRole('textbox');
			const container = input.closest('div');
			expect(container).toHaveClass('border-status-online');
		});

		it('sets aria-invalid for error state', () => {
			render(Input, { props: { errorMessage: 'Error' } });
			expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
		});
	});

	describe('Input Types', () => {
		it('renders text input by default', () => {
			render(Input, { props: {} });
			expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
		});

		it('renders email input', () => {
			render(Input, { props: { type: 'email' } });
			expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
		});

		it('renders password input', () => {
			render(Input, { props: { type: 'password' } });
			const input = document.querySelector('input[type="password"]');
			expect(input).toBeInTheDocument();
		});
	});

	describe('Password Toggle', () => {
		it('shows password toggle button when showPasswordToggle is true', () => {
			render(Input, { props: { type: 'password', showPasswordToggle: true } });
			expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
		});

		it('toggles password visibility when button is clicked', async () => {
			render(Input, { props: { type: 'password', showPasswordToggle: true } });
			const input = document.querySelector('input');
			expect(input).toHaveAttribute('type', 'password');

			const toggleButton = screen.getByRole('button', { name: /show password/i });
			await fireEvent.click(toggleButton);

			expect(input).toHaveAttribute('type', 'text');
			expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
		});

		it('does not show toggle for non-password inputs', () => {
			render(Input, { props: { type: 'text', showPasswordToggle: true } });
			expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument();
		});
	});

	describe('States', () => {
		it('can be disabled', () => {
			render(Input, { props: { disabled: true } });
			expect(screen.getByRole('textbox')).toBeDisabled();
		});

		it('can be readonly', () => {
			render(Input, { props: { readonly: true } });
			expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
		});

		it('can be required', () => {
			render(Input, { props: { required: true } });
			expect(screen.getByRole('textbox')).toBeRequired();
		});

		it('shows required indicator in label', () => {
			render(Input, { props: { label: 'Email', required: true } });
			expect(screen.getByText('*')).toBeInTheDocument();
		});
	});

	describe('Sizes', () => {
		it('renders small size', () => {
			render(Input, { props: { size: 'sm' } });
			const input = screen.getByRole('textbox');
			expect(input).toHaveClass('text-xs');
		});

		it('renders medium size by default', () => {
			render(Input, { props: {} });
			const input = screen.getByRole('textbox');
			expect(input).toHaveClass('text-sm');
		});

		it('renders large size', () => {
			render(Input, { props: { size: 'lg' } });
			const input = screen.getByRole('textbox');
			expect(input).toHaveClass('text-base');
		});
	});

	describe('Events', () => {
		it('calls onchange handler', async () => {
			const handleChange = vi.fn();
			render(Input, { props: { onchange: handleChange } });
			const input = screen.getByRole('textbox');
			await fireEvent.change(input, { target: { value: 'test' } });
			expect(handleChange).toHaveBeenCalled();
		});

		it('calls oninput handler', async () => {
			const handleInput = vi.fn();
			render(Input, { props: { oninput: handleInput } });
			const input = screen.getByRole('textbox');
			await fireEvent.input(input, { target: { value: 'test' } });
			expect(handleInput).toHaveBeenCalled();
		});

		it('calls onfocus handler', async () => {
			const handleFocus = vi.fn();
			render(Input, { props: { onfocus: handleFocus } });
			const input = screen.getByRole('textbox');
			await fireEvent.focus(input);
			expect(handleFocus).toHaveBeenCalled();
		});

		it('calls onblur handler', async () => {
			const handleBlur = vi.fn();
			render(Input, { props: { onblur: handleBlur } });
			const input = screen.getByRole('textbox');
			await fireEvent.blur(input);
			expect(handleBlur).toHaveBeenCalled();
		});
	});

	describe('Validation Attributes', () => {
		it('sets minlength attribute', () => {
			render(Input, { props: { minlength: 5 } });
			expect(screen.getByRole('textbox')).toHaveAttribute('minlength', '5');
		});

		it('sets maxlength attribute', () => {
			render(Input, { props: { maxlength: 100 } });
			expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '100');
		});

		it('sets pattern attribute', () => {
			render(Input, { props: { pattern: '[A-Za-z]+' } });
			expect(screen.getByRole('textbox')).toHaveAttribute('pattern', '[A-Za-z]+');
		});
	});

	describe('Accessibility', () => {
		it('has aria-describedby when helper text is present', () => {
			render(Input, { props: { id: 'test-input', helperText: 'Help' } });
			const input = screen.getByRole('textbox');
			expect(input).toHaveAttribute('aria-describedby', 'test-input-helper');
		});

		it('generates unique id when not provided', () => {
			render(Input, { props: { label: 'Test' } });
			const input = screen.getByRole('textbox');
			expect(input).toHaveAttribute('id');
			expect(input.getAttribute('id')).toMatch(/^input-/);
		});
	});

	describe('Corner Accents', () => {
		it('shows corner accents when enabled', () => {
			const { container } = render(Input, { props: { showCornerAccents: true } });
			const accents = container.querySelectorAll('[aria-hidden="true"]');
			expect(accents.length).toBeGreaterThanOrEqual(4);
		});
	});
});
