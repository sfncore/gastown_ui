/**
 * Workflow API Fixtures
 *
 * Mock data for formulas, molecules, and workflow operations
 */

/** Formula fixture */
export interface MockFormula {
	name: string;
	type: string;
	description: string;
	source: string;
	steps: number;
	vars: number;
}

/** Formula step fixture */
export interface MockFormulaStep {
	id: string;
	title: string;
	description: string;
	required: boolean;
}

/** Molecule fixture */
export interface MockMolecule {
	id: string;
	formula: string;
	status: 'pending' | 'active' | 'completed' | 'failed';
	current_step: number;
	total_steps: number;
	assignee?: string;
	created_at: string;
}

/** Mock formulas */
export const mockFormulas: MockFormula[] = [
	{
		name: 'mol-polecat-work',
		type: 'workflow',
		description: 'Standard polecat work molecule with inbox, work, and completion phases',
		source: 'formulas/mol-polecat-work.yaml',
		steps: 8,
		vars: 2
	},
	{
		name: 'mol-refinery-patrol',
		type: 'workflow',
		description: 'Refinery patrol molecule for processing merge queue',
		source: 'formulas/mol-refinery-patrol.yaml',
		steps: 10,
		vars: 1
	},
	{
		name: 'mol-witness-check',
		type: 'workflow',
		description: 'Witness health check molecule for monitoring polecats',
		source: 'formulas/mol-witness-check.yaml',
		steps: 5,
		vars: 0
	},
	{
		name: 'mol-sprint-planning',
		type: 'workflow',
		description: 'Sprint planning molecule for coordinating work distribution',
		source: 'formulas/mol-sprint-planning.yaml',
		steps: 6,
		vars: 3
	}
];

/** Mock formula details (mol-polecat-work) */
export const mockPolecatWorkFormula = {
	name: 'mol-polecat-work',
	type: 'workflow',
	description: 'Standard polecat work molecule with inbox, work, and completion phases',
	source: 'formulas/mol-polecat-work.yaml',
	steps: [
		{ id: 'inbox-check', title: 'Check Inbox', description: 'Process incoming mail', required: true },
		{ id: 'hook-check', title: 'Check Hook', description: 'Verify work is hooked', required: true },
		{ id: 'context-load', title: 'Load Context', description: 'Prime context from bead', required: true },
		{ id: 'implement', title: 'Implement', description: 'Execute the assigned work', required: true },
		{ id: 'test', title: 'Test', description: 'Verify implementation', required: true },
		{ id: 'commit', title: 'Commit', description: 'Commit changes with proper message', required: true },
		{ id: 'sync', title: 'Sync Beads', description: 'Sync beads with main', required: true },
		{ id: 'done', title: 'Signal Done', description: 'Submit to merge queue', required: true }
	],
	vars: [
		{ name: 'ISSUE_ID', description: 'Issue bead ID to work on', required: true },
		{ name: 'RIG', description: 'Rig name for context', required: false }
	]
};

/** Mock molecules */
export const mockMolecules: MockMolecule[] = [
	{
		id: 'mol-001',
		formula: 'mol-polecat-work',
		status: 'active',
		current_step: 4,
		total_steps: 8,
		assignee: 'furiosa',
		created_at: '2026-01-06T03:40:00Z'
	},
	{
		id: 'mol-002',
		formula: 'mol-polecat-work',
		status: 'active',
		current_step: 3,
		total_steps: 8,
		assignee: 'nux',
		created_at: '2026-01-06T02:30:00Z'
	},
	{
		id: 'mol-003',
		formula: 'mol-refinery-patrol',
		status: 'active',
		current_step: 2,
		total_steps: 10,
		assignee: 'refinery',
		created_at: '2026-01-06T03:00:00Z'
	},
	{
		id: 'mol-004',
		formula: 'mol-witness-check',
		status: 'completed',
		current_step: 5,
		total_steps: 5,
		created_at: '2026-01-06T03:30:00Z'
	}
];

/** Empty formula list */
export const mockEmptyFormulas: MockFormula[] = [];

/** Empty molecule list */
export const mockEmptyMolecules: MockMolecule[] = [];

/** Cook formula response */
export const mockCookResponse = {
	success: true,
	output: {
		molecule_id: 'mol-005',
		formula: 'mol-polecat-work',
		steps: 8
	},
	protoId: 'mol-polecat-work'
};

/** Cook formula error response */
export const mockCookErrorResponse = {
	success: false,
	error: 'Formula not found: unknown-formula'
};

/** Pour molecule response */
export const mockPourResponse = {
	success: true,
	molecule_id: 'mol-005',
	message: 'Molecule poured successfully'
};

/** Get formula by name helper */
export function getFormulaByName(name: string): MockFormula | undefined {
	return mockFormulas.find((formula) => formula.name === name);
}

/** Get molecule by ID helper */
export function getMoleculeById(id: string): MockMolecule | undefined {
	return mockMolecules.find((molecule) => molecule.id === id);
}
