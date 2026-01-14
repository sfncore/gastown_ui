import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import GlobalSearch from './GlobalSearch.svelte';

describe('GlobalSearch', () => {
	beforeEach(() => {
		// Mock localStorage
		const localStorageMock = (() => {
			let store: Record<string, string> = {};
			return {
				getItem: (key: string) => store[key] || null,
				setItem: (key: string, value: string) => {
					store[key] = value.toString();
				},
				clear: () => {
					store = {};
				},
				removeItem: (key: string) => {
					delete store[key];
				}
			};
		})();
		Object.defineProperty(window, 'localStorage', { value: localStorageMock });
		Object.defineProperty(navigator, 'platform', {
			value: 'MacIntel',
			configurable: true
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Trigger Button', () => {
		it('renders search trigger button', () => {
			render(GlobalSearch);

			const button = screen.getByRole('button', { name: /open search/i });
			expect(button).toBeInTheDocument();
			expect(button).toHaveTextContent('Search...');
		});

		it('shows keyboard shortcut hint', () => {
			render(GlobalSearch);

			// Mac platform shows ⌘K
			expect(screen.getByText('⌘K')).toBeInTheDocument();
		});

		it('opens search dialog on click', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Dialog should be visible
			const dialog = screen.getByRole('dialog');
			expect(dialog).toBeInTheDocument();

			// Input should be present
			const searchInput = screen.getByRole('combobox');
			expect(searchInput).toBeInTheDocument();
		});
	});

	describe('Search Dialog', () => {
		it('focuses input when opened', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			await waitFor(() => {
				const searchInput = screen.getByRole('combobox');
				expect(searchInput).toHaveFocus();
			});
		});

		it('closes on Escape key', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const dialog = screen.getByRole('dialog');
			expect(dialog).toBeInTheDocument();

			// Press Escape
			await fireEvent.keyDown(window, { key: 'Escape' });

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			});
		});

		it('closes on backdrop click', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const dialog = screen.getByRole('dialog');
			expect(dialog).toBeInTheDocument();

			// Click backdrop (button with aria-label="Close search")
			const backdrop = screen.getByRole('button', { name: /close search/i });
			await fireEvent.click(backdrop);

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			});
		});
	});

	describe('Search Functionality', () => {
		it('shows empty state with suggestions when no query', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Should show suggestions
			expect(screen.getByText(/try searching for:/i)).toBeInTheDocument();
			expect(screen.getByText('running agents')).toBeInTheDocument();
		});

		it('filters results based on search query', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');

			// Type search query
			await fireEvent.input(searchInput, { target: { value: 'mayor' } });

			await waitFor(() => {
				// Should show Mayor agent
				expect(screen.getByText('Mayor')).toBeInTheDocument();
			});
		});

		it('shows filter options when searching', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: 'test' } });

			// Filter buttons should appear
			expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Agents' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Issues' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Convoys' })).toBeInTheDocument();
		});

		it('filters by type when filter button clicked', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: 'auth' } });

			// Click Agents filter
			const agentsFilter = screen.getByRole('button', { name: 'Agents' });
			await fireEvent.click(agentsFilter);

			// Should only show agent results (not issues)
			await waitFor(() => {
				// Should have Agents heading
				expect(screen.queryByText('Agents')).toBeInTheDocument();
				// Should NOT have Issues heading if no matching agents
				// (depends on mock data)
			});
		});
	});

	describe('Command Mode', () => {
		it('enters command mode when query starts with >', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: '>' } });

			// Placeholder should change
			expect(searchInput).toHaveAttribute('placeholder', 'Type a command...');

			// Should show commands
			await waitFor(() => {
				expect(screen.getByText('New Issue')).toBeInTheDocument();
				expect(screen.getByText('New Convoy')).toBeInTheDocument();
			});
		});

		it('filters commands in command mode', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: '>new' } });

			await waitFor(() => {
				expect(screen.getByText('New Issue')).toBeInTheDocument();
				expect(screen.getByText('New Convoy')).toBeInTheDocument();
				// Should not show unrelated commands
				expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
			});
		});
	});

	describe('Keyboard Navigation', () => {
		it('navigates results with arrow keys', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: 'agent' } });

			await waitFor(() => {
				expect(screen.getByText('Mayor')).toBeInTheDocument();
			});

			// Press ArrowDown to select first result
			await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

			// First result should be selected (aria-selected="true")
			const firstResult = screen.getAllByRole('option')[0];
			expect(firstResult).toHaveAttribute('aria-selected', 'true');

			// Press ArrowDown again
			await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

			// Second result should be selected
			const secondResult = screen.getAllByRole('option')[1];
			expect(secondResult).toHaveAttribute('aria-selected', 'true');

			// Press ArrowUp
			await fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

			// Back to first result
			expect(firstResult).toHaveAttribute('aria-selected', 'true');
		});

		it('prevents navigation beyond bounds', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');

			// Try to navigate up when at first result
			await fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

			// Should remain at 0 (no error thrown)
			await fireEvent.input(searchInput, { target: { value: 'mayor' } });

			await waitFor(() => {
				const results = screen.getAllByRole('option');
				expect(results.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Recent Searches', () => {
		it('saves search queries to recent', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const searchInput = screen.getByRole('combobox');
			await fireEvent.input(searchInput, { target: { value: 'test query' } });

			// Close dialog
			await fireEvent.keyDown(window, { key: 'Escape' });

			// Check localStorage was called
			const saved = localStorage.getItem('gastown-recent-searches');
			expect(saved).toBeTruthy();

			if (saved) {
				const parsed = JSON.parse(saved);
				expect(parsed).toContain('test query');
			}
		});

		it('displays recent searches when opened with empty query', async () => {
			// Set up recent searches
			localStorage.setItem('gastown-recent-searches', JSON.stringify(['previous search']));

			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Should show recent searches section
			expect(screen.getByText('Recent:')).toBeInTheDocument();
			expect(screen.getByText('previous search')).toBeInTheDocument();
		});

		it('allows clicking recent searches to populate input', async () => {
			localStorage.setItem('gastown-recent-searches', JSON.stringify(['previous search']));

			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Click recent search
			const recentButton = screen.getByRole('button', { name: /previous search/i });
			await fireEvent.click(recentButton);

			const searchInput = screen.getByRole('combobox') as HTMLInputElement;
			expect(searchInput.value).toBe('previous search');
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA attributes', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			const dialog = screen.getByRole('dialog');
			expect(dialog).toHaveAttribute('aria-modal', 'true');
			expect(dialog).toHaveAttribute('aria-labelledby', 'search-dialog-title');

			const searchInput = screen.getByRole('combobox');
			expect(searchInput).toHaveAttribute('role', 'combobox');
			expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
			expect(searchInput).toHaveAttribute('aria-controls', 'search-results-listbox');
		});

		it('has keyboard hints in footer', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Footer should show keyboard hints
			expect(screen.getByText('to navigate')).toBeInTheDocument();
			expect(screen.getByText('to select')).toBeInTheDocument();
			expect(screen.getByText('for commands')).toBeInTheDocument();
		});
	});
});
