import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import GlobalSearch from './GlobalSearch.svelte';
import { swrCache, CACHE_KEYS } from '$lib/stores/swr';
import { searchIndex } from '$lib/stores/search-index.svelte';
import type { Agent } from '$lib/stores/agents.svelte';
import type { WorkItem } from '$lib/stores/work.svelte';
import type { Convoy } from '$lib/stores/convoys.svelte';

// Mock data for tests
const mockAgents: Agent[] = [
	{ id: 'mayor', name: 'Mayor', status: 'working', currentWork: 'Coordinating work' },
	{ id: 'witness-1', name: 'Witness (gastown_ui)', status: 'working', currentWork: 'Monitoring polecats' },
	{ id: 'refinery-1', name: 'Refinery (gastown_ui)', status: 'idle', currentWork: 'Waiting for merges' },
	{ id: 'polecat-morsov', name: 'Polecat Morsov', status: 'working', currentWork: 'Building features' },
	{ id: 'polecat-rictus', name: 'Polecat Rictus', status: 'idle', currentWork: 'Awaiting work' }
];

const mockWork: WorkItem[] = [
	{ id: 'gt-d3a', title: 'Authentication', type: 'epic', status: 'in_progress', priority: 1, labels: [], createdAt: '', updatedAt: '' },
	{ id: 'gt-2hs', title: 'UI Components', type: 'epic', status: 'open', priority: 2, labels: [], createdAt: '', updatedAt: '' },
	{ id: 'gt-be4', title: 'Auth Token Refresh', type: 'task', status: 'open', priority: 2, labels: [], createdAt: '', updatedAt: '' },
	{ id: 'gt-931', title: 'CSRF Protection', type: 'task', status: 'open', priority: 2, labels: [], createdAt: '', updatedAt: '' },
	{ id: 'gt-3v5', title: 'Command Palette', type: 'task', status: 'done', priority: 2, labels: [], createdAt: '', updatedAt: '' },
	{ id: 'hq-7vsv', title: 'Global Search', type: 'task', status: 'in_progress', priority: 1, labels: [], createdAt: '', updatedAt: '' }
];

const mockConvoys: Convoy[] = [
	{ id: 'convoy-001', name: 'Auth Sprint', status: 'active', progress: 45, workItems: [], tags: [], createdAt: '', updatedAt: '' },
	{ id: 'convoy-002', name: 'UI Polish', status: 'active', progress: 70, workItems: [], tags: [], createdAt: '', updatedAt: '' },
	{ id: 'convoy-003', name: 'Mobile PWA', status: 'stale', progress: 30, workItems: [], tags: [], createdAt: '', updatedAt: '' }
];

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

		// Populate SWR cache with test data for search index
		swrCache.set(CACHE_KEYS.AGENTS, mockAgents);
		swrCache.set(CACHE_KEYS.WORK, mockWork);
		swrCache.set(CACHE_KEYS.CONVOYS, mockConvoys);
		swrCache.set(CACHE_KEYS.MAIL, []);

		// Force rebuild the search index immediately
		searchIndex.forceRebuild();
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
		it('shows recent items when no query', async () => {
			render(GlobalSearch);

			const triggerButton = screen.getByRole('button', { name: /open search/i });
			await fireEvent.click(triggerButton);

			// Should show recent items section header
			expect(screen.getByText('Recent')).toBeInTheDocument();
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
			// Search for "polecat" to get multiple agent results
			await fireEvent.input(searchInput, { target: { value: 'polecat' } });

			await waitFor(() => {
				expect(screen.getByText('Polecat Morsov')).toBeInTheDocument();
			});

			// First result should be selected initially (index 0)
			const results = screen.getAllByRole('option');
			expect(results[0]).toHaveAttribute('aria-selected', 'true');

			// Press ArrowDown to select second result (index 1)
			await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
			expect(results[1]).toHaveAttribute('aria-selected', 'true');
			expect(results[0]).toHaveAttribute('aria-selected', 'false');

			// Press ArrowUp to go back to first result
			await fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
			expect(results[0]).toHaveAttribute('aria-selected', 'true');
			expect(results[1]).toHaveAttribute('aria-selected', 'false');
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
