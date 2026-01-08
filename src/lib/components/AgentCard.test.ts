/**
 * AgentCard Component Tests
 *
 * Tests for AgentCard rendering, status variants, and content display.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AgentCard from './AgentCard.svelte';

describe('AgentCard', () => {
	describe('Basic Rendering', () => {
		it('renders agent name', () => {
			render(AgentCard, { props: { name: 'Agent Smith' } });
			expect(screen.getByRole('heading', { name: 'Agent Smith' })).toBeInTheDocument();
		});

		it('renders as an article element', () => {
			render(AgentCard, { props: { name: 'Test Agent' } });
			expect(screen.getByRole('article')).toBeInTheDocument();
		});

		it('renders task description when provided', () => {
			render(AgentCard, {
				props: { name: 'Agent', task: 'Processing data files' }
			});
			expect(screen.getByText('Processing data files')).toBeInTheDocument();
		});

		it('renders meta information when provided', () => {
			render(AgentCard, {
				props: { name: 'Agent', meta: 'Started 5 minutes ago' }
			});
			expect(screen.getByText('Started 5 minutes ago')).toBeInTheDocument();
		});

		it('does not render task section when task is empty', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			// Only the header should be present, no extra div for task
			const article = screen.getByRole('article');
			expect(article.querySelectorAll('.space-y-1').length).toBe(0);
		});
	});

	describe('Status Variants', () => {
		it('renders idle status by default', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('border-status-idle/30');
		});

		it('renders running status', () => {
			render(AgentCard, { props: { name: 'Agent', status: 'running' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('border-status-online/30');
		});

		it('renders error status with shake animation', () => {
			render(AgentCard, { props: { name: 'Agent', status: 'error' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('border-status-offline/60');
			expect(article).toHaveClass('shadow-glow-destructive');
			expect(article).toHaveClass('animate-[pulse-status_2s_ease-in-out_infinite]');
		});

		it('renders complete status', () => {
			render(AgentCard, { props: { name: 'Agent', status: 'complete' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('border-status-online/30');
		});
	});

	describe('Progress Bar', () => {
		it('shows progress bar when status is running and progress > 0', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'running', progress: 50 }
			});
			expect(screen.getByRole('progressbar')).toBeInTheDocument();
		});

		it('does not show progress bar when status is idle', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'idle', progress: 50 }
			});
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});

		it('does not show progress bar when progress is 0', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'running', progress: 0 }
			});
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});

		it('does not show progress bar for error status', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'error', progress: 50 }
			});
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});

		it('does not show progress bar for complete status', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'complete', progress: 100 }
			});
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});
	});

	describe('Status Indicator', () => {
		it('displays a status indicator for running status', () => {
			const { container } = render(AgentCard, {
				props: { name: 'Agent', status: 'running' }
			});
			// StatusIndicator component should be rendered with bg-status-online class
			const indicator = container.querySelector('.bg-status-online');
			expect(indicator).toBeInTheDocument();
		});

		it('displays a status indicator for idle status', () => {
			const { container } = render(AgentCard, {
				props: { name: 'Agent', status: 'idle' }
			});
			const indicator = container.querySelector('.bg-status-idle');
			expect(indicator).toBeInTheDocument();
		});

		it('displays a status indicator for error status', () => {
			const { container } = render(AgentCard, {
				props: { name: 'Agent', status: 'error' }
			});
			const indicator = container.querySelector('.bg-status-offline');
			expect(indicator).toBeInTheDocument();
		});
	});

	describe('Custom Classes', () => {
		it('accepts custom class names', () => {
			render(AgentCard, {
				props: { name: 'Agent', class: 'my-custom-class' }
			});
			const article = screen.getByRole('article');
			expect(article).toHaveClass('my-custom-class');
		});
	});

	describe('Glass Panel Styling', () => {
		it('has panel-glass class', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('panel-glass');
		});

		it('has hover shadow effect', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('hover:shadow-elevation-3');
		});
	});

	describe('Text Truncation', () => {
		it('truncates long agent names', () => {
			render(AgentCard, {
				props: { name: 'Very Long Agent Name That Should Be Truncated' }
			});
			const heading = screen.getByRole('heading');
			expect(heading).toHaveClass('truncate');
		});

		it('clamps task text to 2 lines', () => {
			render(AgentCard, {
				props: {
					name: 'Agent',
					task: 'This is a very long task description that should be clamped to two lines maximum for better visual appearance'
				}
			});
			const taskText = screen.getByText(/this is a very long task/i);
			expect(taskText).toHaveClass('line-clamp-2');
		});
	});

	describe('Semantic HTML', () => {
		it('uses article as root element', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			expect(screen.getByRole('article')).toBeInTheDocument();
		});

		it('uses header for name section', () => {
			const { container } = render(AgentCard, { props: { name: 'Agent' } });
			expect(container.querySelector('header')).toBeInTheDocument();
		});

		it('renders a progress label when running', () => {
			render(AgentCard, {
				props: { name: 'Agent', status: 'running', progress: 50 }
			});
			expect(screen.getByText('50%')).toBeInTheDocument();
		});

		it('uses h3 for agent name', () => {
			render(AgentCard, { props: { name: 'Agent' } });
			expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
		});
	});

	describe('Multiple Props Combinations', () => {
		it('renders all content correctly when all props provided', () => {
			render(AgentCard, {
				props: {
					name: 'Test Agent',
					status: 'running',
					task: 'Processing data',
					meta: 'Started 5m ago',
					progress: 75
				}
			});

			expect(screen.getByText('Test Agent')).toBeInTheDocument();
			expect(screen.getByText('Processing data')).toBeInTheDocument();
			expect(screen.getByText('Started 5m ago')).toBeInTheDocument();
			expect(screen.getByRole('progressbar')).toBeInTheDocument();
		});

		it('renders minimal card with only name', () => {
			const { container } = render(AgentCard, { props: { name: 'Minimal Agent' } });

			expect(screen.getByText('Minimal Agent')).toBeInTheDocument();
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
			// Should only have header, no body content
			expect(container.querySelector('.space-y-1')).not.toBeInTheDocument();
		});
	});
});
