import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ActivityFeed from './ActivityFeed.svelte';
import type { ActivityEvent } from './ActivityFeed.svelte';

describe('ActivityFeed', () => {
	const mockEvents: ActivityEvent[] = [
		{
			id: '1',
			timestamp: new Date().toISOString(),
			type: 'work_started',
			actor: 'furiosa',
			actorDisplay: 'Furiosa',
			description: 'Started work on task gu-123',
			icon: 'play-circle'
		},
		{
			id: '2',
			timestamp: new Date().toISOString(),
			type: 'mail_sent',
			actor: 'mayor',
			actorDisplay: 'Mayor',
			description: 'Sent mail to furiosa: Check your assignment',
			icon: 'send'
		}
	];

	it('renders events', () => {
		render(ActivityFeed, { props: { events: mockEvents } });

		expect(screen.getByText('Furiosa')).toBeInTheDocument();
		expect(screen.getByText('Started work on task gu-123')).toBeInTheDocument();
		expect(screen.getByText('Mayor')).toBeInTheDocument();
	});

	it('shows empty state when no events', () => {
		render(ActivityFeed, { props: { events: [] } });

		expect(screen.getByText('No activity yet')).toBeInTheDocument();
	});

	it('shows custom empty message', () => {
		render(ActivityFeed, {
			props: { events: [], emptyMessage: 'No recent activity' }
		});

		expect(screen.getByText('No recent activity')).toBeInTheDocument();
	});

	it('limits number of events displayed', () => {
		const manyEvents: ActivityEvent[] = Array.from({ length: 20 }, (_, i) => ({
			id: `event-${i}`,
			timestamp: new Date().toISOString(),
			type: 'test_event',
			actor: `actor-${i}`,
			description: `Event ${i}`,
			icon: 'activity'
		}));

		const { container } = render(ActivityFeed, {
			props: { events: manyEvents, limit: 5 }
		});

		// Count rendered event items (looking for elements with event content)
		const eventElements = container.querySelectorAll('[class*="flex items-start gap-3"]');
		expect(eventElements.length).toBeLessThanOrEqual(5);
	});

	it('applies compact mode styling', () => {
		const { container } = render(ActivityFeed, {
			props: { events: mockEvents, compact: true }
		});

		// Check for compact padding class
		const eventContainer = container.querySelector('[class*="p-2"]');
		expect(eventContainer).toBeInTheDocument();
	});

	it('shows full timestamps when configured', () => {
		const event: ActivityEvent = {
			id: '1',
			timestamp: '2024-01-15T10:30:00.000Z',
			type: 'test',
			actor: 'test',
			description: 'Test event',
			icon: 'activity'
		};

		const { container } = render(ActivityFeed, {
			props: { events: [event], showFullTimestamp: true }
		});

		// Should show month in full timestamp
		const timeElement = container.querySelector('time');
		expect(timeElement?.textContent).toMatch(/Jan/);
	});

	it('hides date headers when configured', () => {
		const { container } = render(ActivityFeed, {
			props: { events: mockEvents, showDateHeaders: false }
		});

		// Should not have date header elements
		const dateHeaders = container.querySelectorAll('[class*="uppercase tracking-wide"]');
		expect(dateHeaders.length).toBe(0);
	});

	it('applies custom className', () => {
		const { container } = render(ActivityFeed, {
			props: { events: mockEvents, class: 'custom-feed' }
		});

		expect(container.querySelector('.custom-feed')).toBeInTheDocument();
	});

	it('groups events by date when date headers enabled', () => {
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const eventsAcrossDays: ActivityEvent[] = [
			{
				id: '1',
				timestamp: today.toISOString(),
				type: 'test',
				actor: 'actor1',
				description: 'Today event',
				icon: 'activity'
			},
			{
				id: '2',
				timestamp: yesterday.toISOString(),
				type: 'test',
				actor: 'actor2',
				description: 'Yesterday event',
				icon: 'activity'
			}
		];

		render(ActivityFeed, {
			props: { events: eventsAcrossDays, showDateHeaders: true }
		});

		expect(screen.getByText('Today')).toBeInTheDocument();
		expect(screen.getByText('Yesterday')).toBeInTheDocument();
	});

	it('displays event type badge', () => {
		render(ActivityFeed, { props: { events: mockEvents } });

		// Event types should be displayed and formatted (underscores to spaces)
		expect(screen.getByText('work started')).toBeInTheDocument();
		expect(screen.getByText('mail sent')).toBeInTheDocument();
	});
});
