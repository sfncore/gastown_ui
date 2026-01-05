/**
 * Workflow API Handlers
 *
 * MSW handlers for formulas, molecules, and workflow operations
 */

import { http, HttpResponse, delay } from 'msw';
import {
	mockFormulas,
	mockMolecules,
	mockPolecatWorkFormula,
	mockEmptyFormulas,
	mockEmptyMolecules,
	getFormulaByName,
	getMoleculeById,
	mockCookResponse,
	mockCookErrorResponse,
	mockPourResponse
} from '../fixtures/workflows';

/** Simulated network delay (ms) */
const NETWORK_DELAY = 100;

/** State for simulating different scenarios */
export const workflowState = {
	shouldFail: false,
	useEmptyData: false,
	cookSuccess: true,
	pourSuccess: true,
	errorMessage: 'Failed to process workflow'
};

export const workflowHandlers = [
	/**
	 * GET /api/gastown/workflows/formulas
	 * Returns list of available formulas
	 */
	http.get('/api/gastown/workflows/formulas', async () => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch formulas' },
				{ status: 500 }
			);
		}

		if (workflowState.useEmptyData) {
			return HttpResponse.json(mockEmptyFormulas);
		}

		return HttpResponse.json(mockFormulas);
	}),

	/**
	 * GET /api/gastown/workflows/formulas/:name
	 * Returns detailed formula by name
	 */
	http.get('/api/gastown/workflows/formulas/:name', async ({ params }) => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch formula' },
				{ status: 500 }
			);
		}

		const name = params.name as string;

		// Special case for detailed formula
		if (name === 'mol-polecat-work') {
			return HttpResponse.json(mockPolecatWorkFormula);
		}

		const formula = getFormulaByName(name);

		if (!formula) {
			return HttpResponse.json(
				{ error: 'Formula not found' },
				{ status: 404 }
			);
		}

		return HttpResponse.json(formula);
	}),

	/**
	 * GET /api/gastown/workflows/molecules
	 * Returns list of active molecules
	 */
	http.get('/api/gastown/workflows/molecules', async () => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch molecules' },
				{ status: 500 }
			);
		}

		if (workflowState.useEmptyData) {
			return HttpResponse.json(mockEmptyMolecules);
		}

		return HttpResponse.json(mockMolecules);
	}),

	/**
	 * GET /api/gastown/workflows/molecules/:id
	 * Returns a specific molecule by ID
	 */
	http.get('/api/gastown/workflows/molecules/:id', async ({ params }) => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail) {
			return HttpResponse.json(
				{ error: 'Failed to fetch molecule' },
				{ status: 500 }
			);
		}

		const molecule = getMoleculeById(params.id as string);

		if (!molecule) {
			return HttpResponse.json(
				{ error: 'Molecule not found' },
				{ status: 404 }
			);
		}

		return HttpResponse.json(molecule);
	}),

	/**
	 * POST /api/gastown/workflows/cook
	 * Cooks a formula into a proto/molecule
	 */
	http.post('/api/gastown/workflows/cook', async ({ request }) => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail || !workflowState.cookSuccess) {
			return HttpResponse.json(mockCookErrorResponse, { status: 400 });
		}

		const body = await request.json() as { formula?: string };

		if (!body.formula) {
			return HttpResponse.json(
				{ success: false, error: 'Formula name required' },
				{ status: 400 }
			);
		}

		// Check if formula exists
		const formula = getFormulaByName(body.formula);
		if (!formula) {
			return HttpResponse.json(
				{ success: false, error: `Formula not found: ${body.formula}` },
				{ status: 404 }
			);
		}

		return HttpResponse.json({
			...mockCookResponse,
			output: {
				...mockCookResponse.output,
				formula: body.formula
			},
			protoId: body.formula
		});
	}),

	/**
	 * POST /api/gastown/workflows/pour
	 * Pours a molecule to start execution
	 */
	http.post('/api/gastown/workflows/pour', async ({ request }) => {
		await delay(NETWORK_DELAY);

		if (workflowState.shouldFail || !workflowState.pourSuccess) {
			return HttpResponse.json(
				{ success: false, error: 'Failed to pour molecule' },
				{ status: 500 }
			);
		}

		const body = await request.json() as { molecule_id?: string };

		if (!body.molecule_id) {
			return HttpResponse.json(
				{ success: false, error: 'Molecule ID required' },
				{ status: 400 }
			);
		}

		return HttpResponse.json({
			...mockPourResponse,
			molecule_id: body.molecule_id
		});
	})
];
