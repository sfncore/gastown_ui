/**
 * StatsCard Component Tests
 *
 * Tests for values, trends, sparklines, and hover effects.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatsCard from './StatsCard.svelte';

describe('StatsCard', () => {
	describe('Label and Value', () => {
		it('renders label', () => {
			render(StatsCard, { props: { label: 'Active Agents', value: 42 } });
			expect(screen.getByText('Active Agents')).toBeInTheDocument();
		});

		it('renders numeric value', () => {
			render(StatsCard, { props: { label: 'Count', value: 42 } });
			expect(screen.getByText('42')).toBeInTheDocument();
		});

		it('renders string value', () => {
			render(StatsCard, { props: { label: 'Status', value: 'OK' } });
			expect(screen.getByText('OK')).toBeInTheDocument();
		});

		it('renders value with suffix', () => {
			render(StatsCard, { props: { label: 'Uptime', value: 99.9, suffix: '%' } });
			expect(screen.getByText('99.9%')).toBeInTheDocument();
		});

		it('applies font-mono to value', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const value = screen.getByText('42');
			expect(value).toHaveClass('font-mono');
		});

		it('applies font-bold to value', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const value = screen.getByText('42');
			expect(value).toHaveClass('font-bold');
		});

		it('applies 32px text size to value', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const value = screen.getByText('42');
			expect(value).toHaveClass('text-[32px]');
		});
	});

	describe('Trend Indicators', () => {
		it('shows up trend with success color', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, trend: 'up', trendValue: 12.5 } });
			const article = screen.getByRole('article');
			const trendElement = article.querySelector('.text-success');
			expect(trendElement).toBeInTheDocument();
		});

		it('shows down trend with destructive color', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, trend: 'down', trendValue: -5.0 } });
			const article = screen.getByRole('article');
			const trendElement = article.querySelector('.text-destructive');
			expect(trendElement).toBeInTheDocument();
		});

		it('formats positive trend value with plus sign', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, trend: 'up', trendValue: 12.5 } });
			expect(screen.getByText('+12.5%')).toBeInTheDocument();
		});

		it('formats negative trend value', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, trend: 'down', trendValue: -5.0 } });
			expect(screen.getByText('-5.0%')).toBeInTheDocument();
		});
	});

	describe('Comparison Text', () => {
		it('renders comparison text with trend value', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					trend: 'up',
					trendValue: 12.5,
					comparisonText: 'from yesterday'
				}
			});
			expect(screen.getByText('from yesterday')).toBeInTheDocument();
		});

		it('does not render comparison without trend value', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					comparisonText: 'from yesterday'
				}
			});
			expect(screen.queryByText('from yesterday')).not.toBeInTheDocument();
		});
	});

	describe('Sparkline', () => {
		it('renders sparkline SVG when data provided', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					sparklineData: [10, 15, 12, 18, 20, 17, 22]
				}
			});
			const article = screen.getByRole('article');
			const svg = article.querySelector('svg');
			expect(svg).toBeInTheDocument();
		});

		it('does not render sparkline with insufficient data', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					sparklineData: [10]
				}
			});
			const article = screen.getByRole('article');
			const svg = article.querySelector('svg');
			expect(svg).not.toBeInTheDocument();
		});

		it('sparkline has correct height (40px)', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					sparklineData: [10, 15, 12, 18, 20, 17, 22]
				}
			});
			const article = screen.getByRole('article');
			const container = article.querySelector('.h-10');
			expect(container).toBeInTheDocument();
		});

		it('sparkline has aria-label for accessibility', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					sparklineData: [10, 15, 12, 18, 20, 17, 22]
				}
			});
			const article = screen.getByRole('article');
			const svg = article.querySelector('svg[aria-label]');
			expect(svg).toHaveAttribute('aria-label', '7-day trend');
		});
	});

	describe('Status Breakdown', () => {
		it('renders status breakdown items', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					statusBreakdown: [
						{ label: 'running', value: 38, status: 'success' },
						{ label: 'idle', value: 4, status: 'muted' }
					]
				}
			});
			expect(screen.getByText('running')).toBeInTheDocument();
			expect(screen.getByText('38')).toBeInTheDocument();
			expect(screen.getByText('idle')).toBeInTheDocument();
			expect(screen.getByText('4')).toBeInTheDocument();
		});

		it('renders status dots with correct colors', () => {
			render(StatsCard, {
				props: {
					label: 'Test',
					value: 42,
					statusBreakdown: [
						{ label: 'active', value: 10, status: 'success' }
					]
				}
			});
			const article = screen.getByRole('article');
			const footer = article.querySelector('footer');
			const dot = footer?.querySelector('.bg-success');
			expect(dot).toBeInTheDocument();
		});
	});

	describe('Hover Effect', () => {
		it('has hover scale class', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('hover:scale-[1.02]');
		});

		it('has hover shadow class', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('hover:shadow-lg');
		});
	});

	describe('Padding', () => {
		it('has p-6 padding', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('p-6');
		});
	});

	describe('Custom Classes', () => {
		it('accepts custom class names', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, class: 'my-custom-class' } });
			const article = screen.getByRole('article');
			expect(article).toHaveClass('my-custom-class');
		});
	});

	describe('Accessibility', () => {
		it('has article role', () => {
			render(StatsCard, { props: { label: 'Test', value: 42 } });
			expect(screen.getByRole('article')).toBeInTheDocument();
		});

		it('trend icon is hidden from screen readers', () => {
			render(StatsCard, { props: { label: 'Test', value: 42, trend: 'up', trendValue: 10 } });
			const article = screen.getByRole('article');
			const hiddenIcon = article.querySelector('[aria-hidden="true"]');
			expect(hiddenIcon).toBeInTheDocument();
		});
	});
});
