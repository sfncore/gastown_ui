/**
 * Gas Town API Fixtures
 *
 * Mock data for Gas Town status, rigs, and agents
 */

/** Agent status fixture */
export interface MockAgent {
	name: string;
	address: string;
	session?: string;
	role: string;
	running: boolean;
	has_work: boolean;
	state?: string;
	unread_mail?: number;
	first_subject?: string;
}

/** Hook fixture */
export interface MockHook {
	agent: string;
	role: string;
	has_work: boolean;
	bead_id?: string;
}

/** Rig fixture */
export interface MockRig {
	name: string;
	polecats: string[];
	has_witness: boolean;
	has_refinery: boolean;
	hooks: MockHook[];
	agents: MockAgent[];
}

/** Full status fixture */
export interface MockStatus {
	name: string;
	agents: MockAgent[];
	rigs: MockRig[];
}

/** Mock agents at town level */
export const mockTownAgents: MockAgent[] = [
	{
		name: 'mayor',
		address: 'mayor/',
		session: 'session-mayor-001',
		role: 'coordinator',
		running: true,
		has_work: true,
		unread_mail: 2,
		first_subject: 'Coordinate sprint tasks'
	},
	{
		name: 'deacon',
		address: 'deacon/',
		session: 'session-deacon-001',
		role: 'health-check',
		running: true,
		has_work: false
	}
];

/** Mock rig with agents */
export const mockRig: MockRig = {
	name: 'gastown_ui',
	polecats: ['furiosa', 'nux', 'rictus', 'morsov', 'slit'],
	has_witness: true,
	has_refinery: true,
	hooks: [
		{ agent: 'gastown_ui/polecats/furiosa', role: 'polecat', has_work: true, bead_id: 'gt-abc' },
		{ agent: 'gastown_ui/polecats/nux', role: 'polecat', has_work: true, bead_id: 'gt-def' },
		{ agent: 'gastown_ui/polecats/rictus', role: 'polecat', has_work: false },
		{ agent: 'gastown_ui/polecats/morsov', role: 'polecat', has_work: true, bead_id: 'gt-ghi' },
		{ agent: 'gastown_ui/polecats/slit', role: 'polecat', has_work: false }
	],
	agents: [
		{
			name: 'witness',
			address: 'gastown_ui/witness',
			session: 'session-witness-001',
			role: 'witness',
			running: true,
			has_work: false
		},
		{
			name: 'refinery',
			address: 'gastown_ui/refinery',
			session: 'session-refinery-001',
			role: 'refinery',
			running: true,
			has_work: true
		},
		{
			name: 'furiosa',
			address: 'gastown_ui/polecats/furiosa',
			session: 'session-furiosa-001',
			role: 'polecat',
			running: true,
			has_work: true,
			first_subject: 'Implementing CSRF protection'
		},
		{
			name: 'nux',
			address: 'gastown_ui/polecats/nux',
			session: 'session-nux-001',
			role: 'polecat',
			running: true,
			has_work: true,
			first_subject: 'Mobile tab views'
		},
		{
			name: 'rictus',
			address: 'gastown_ui/polecats/rictus',
			role: 'polecat',
			running: false,
			has_work: false
		},
		{
			name: 'morsov',
			address: 'gastown_ui/polecats/morsov',
			session: 'session-morsov-001',
			role: 'polecat',
			running: true,
			has_work: true,
			first_subject: 'Command palette component'
		},
		{
			name: 'slit',
			address: 'gastown_ui/polecats/slit',
			role: 'polecat',
			running: false,
			has_work: false,
			state: 'dead'
		}
	]
};

/** Full Gas Town status */
export const mockGasTownStatus: MockStatus = {
	name: 'gastown',
	agents: mockTownAgents,
	rigs: [mockRig]
};

/** Rig list response */
export const mockRigList = [
	{
		name: 'gastown_ui',
		path: '/Users/amrit/Documents/Projects/gastown_exp/gastown_ui',
		polecats: 5,
		has_witness: true,
		has_refinery: true
	}
];

/** Empty status (no rigs) */
export const mockEmptyStatus: MockStatus = {
	name: 'gastown',
	agents: mockTownAgents,
	rigs: []
};

/** Error agent (crashed) */
export const mockErrorAgent: MockAgent = {
	name: 'crashed-agent',
	address: 'gastown_ui/polecats/crashed',
	role: 'polecat',
	running: false,
	has_work: true,
	state: 'dead'
};
