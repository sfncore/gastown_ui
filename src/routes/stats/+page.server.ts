import type { PageServerLoad } from './$types';

export interface AgentStats {
	id: string;
	name: string;
	role: string;
	tasksCompleted: number;
	avgResponseTime: number;
	lastActive: string;
}

export interface ConvoyStats {
	id: string;
	name: string;
	completionTime: number; // minutes
	tasksCompleted: number;
	agent: string;
}

export interface IssueCloser {
	name: string;
	closed: number;
	avgTimeToClose: number; // hours
}

export interface DailyActivity {
	date: string;
	label: string;
	active: number;
	idle: number;
	completed: number;
}

export interface HourlyVolume {
	hour: number;
	label: string;
	messages: number;
}

export interface StatsData {
	summary: {
		totalAgents: number;
		activeAgents: number;
		idleAgents: number;
		deadAgents: number;
		totalRigs: number;
		totalConvoys: number;
		activeConvoys: number;
		completedConvoys: number;
		totalIssues: number;
		openIssues: number;
		closedIssues: number;
		messagesToday: number;
	};
	health: {
		uptime: number; // percentage
		avgResponseTime: number; // ms
		errorRate: number; // percentage
	};
	charts: {
		dailyActivity: DailyActivity[];
		issueCompletion: { completed: number; open: number; rate: number };
		hourlyVolume: HourlyVolume[];
	};
	leaderboards: {
		mostActiveAgents: AgentStats[];
		fastestConvoys: ConvoyStats[];
		topIssueClosers: IssueCloser[];
	};
	filters: {
		rigs: string[];
		timeRange: string;
	};
	timestamp: string;
}

function generateMockStats(timeRange: string, rig: string | null): StatsData {
	// Generate realistic mock data
	const multiplier = timeRange === 'today' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

	const dailyActivity: DailyActivity[] = [];
	const today = new Date();
	const days = Math.min(multiplier, 7);

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		dailyActivity.push({
			date: date.toISOString().split('T')[0],
			label: dayNames[date.getDay()],
			active: Math.floor(Math.random() * 8) + 2,
			idle: Math.floor(Math.random() * 4),
			completed: Math.floor(Math.random() * 15) + 5
		});
	}

	const hourlyVolume: HourlyVolume[] = [];
	for (let h = 0; h < 24; h++) {
		const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
		const isWorkHour = h >= 9 && h <= 18;
		hourlyVolume.push({
			hour: h,
			label,
			messages: isWorkHour ? Math.floor(Math.random() * 50) + 20 : Math.floor(Math.random() * 15)
		});
	}

	const completedIssues = Math.floor(45 * multiplier / 7);
	const openIssues = Math.floor(Math.random() * 20) + 10;

	return {
		summary: {
			totalAgents: 12,
			activeAgents: 8,
			idleAgents: 3,
			deadAgents: 1,
			totalRigs: 3,
			totalConvoys: Math.floor(25 * multiplier / 7),
			activeConvoys: 4,
			completedConvoys: Math.floor(21 * multiplier / 7),
			totalIssues: completedIssues + openIssues,
			openIssues,
			closedIssues: completedIssues,
			messagesToday: Math.floor(Math.random() * 200) + 100
		},
		health: {
			uptime: 99.7,
			avgResponseTime: 245,
			errorRate: 0.3
		},
		charts: {
			dailyActivity,
			issueCompletion: {
				completed: completedIssues,
				open: openIssues,
				rate: Math.round((completedIssues / (completedIssues + openIssues)) * 100)
			},
			hourlyVolume
		},
		leaderboards: {
			mostActiveAgents: [
				{ id: 'mayor', name: 'Mayor', role: 'coordinator', tasksCompleted: 156, avgResponseTime: 180, lastActive: '2 min ago' },
				{ id: 'deacon', name: 'Deacon', role: 'health-check', tasksCompleted: 89, avgResponseTime: 120, lastActive: '1 min ago' },
				{ id: 'rictus', name: 'Rictus', role: 'polecat', tasksCompleted: 67, avgResponseTime: 320, lastActive: 'now' },
				{ id: 'nux', name: 'Nux', role: 'polecat', tasksCompleted: 54, avgResponseTime: 280, lastActive: '5 min ago' },
				{ id: 'witness-gt', name: 'Witness (GT)', role: 'witness', tasksCompleted: 42, avgResponseTime: 150, lastActive: '3 min ago' }
			],
			fastestConvoys: [
				{ id: 'conv-1', name: 'Auth Feature', completionTime: 12, tasksCompleted: 4, agent: 'rictus' },
				{ id: 'conv-2', name: 'Bug Fix Sprint', completionTime: 18, tasksCompleted: 7, agent: 'nux' },
				{ id: 'conv-3', name: 'UI Polish', completionTime: 25, tasksCompleted: 5, agent: 'rictus' },
				{ id: 'conv-4', name: 'API Update', completionTime: 32, tasksCompleted: 3, agent: 'slit' },
				{ id: 'conv-5', name: 'Docs Refresh', completionTime: 45, tasksCompleted: 8, agent: 'nux' }
			],
			topIssueClosers: [
				{ name: 'Mayor', closed: 45, avgTimeToClose: 2.3 },
				{ name: 'Rictus', closed: 38, avgTimeToClose: 4.1 },
				{ name: 'Nux', closed: 32, avgTimeToClose: 3.8 },
				{ name: 'Deacon', closed: 28, avgTimeToClose: 1.5 },
				{ name: 'Witness', closed: 15, avgTimeToClose: 0.8 }
			]
		},
		filters: {
			rigs: ['gastown_ui', 'api_server', 'data_pipeline'],
			timeRange
		},
		timestamp: new Date().toISOString()
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const timeRange = url.searchParams.get('range') || '7d';
	const rig = url.searchParams.get('rig');

	try {
		const stats = generateMockStats(timeRange, rig);
		return { stats, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch statistics';
		return {
			stats: null,
			error: message
		};
	}
};
