/**
 * Mail Compose Page Server Load & Actions
 *
 * Loads available agent addresses for autocomplete.
 * Handles sending mail via gt mail send command.
 */

import { spawn } from 'node:child_process';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { execGt, getTownCwd } from '$lib/server/gt';

/**
 * Execute CLI command safely using spawn (no shell injection risk)
 * Returns a promise that resolves with stdout or rejects with error
 */
function spawnAsync(
	command: string,
	args: string[],
	options: { timeout?: number } = {}
): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd: getTownCwd(),
			timeout: options.timeout,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		proc.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(stderr || `Command failed with code ${code}`));
			}
		});

		proc.on('error', (err) => {
			reject(err);
		});
	});
}

interface GtStatusAgent {
	name: string;
	address: string;
	role: string;
	running: boolean;
}

interface GtStatusRig {
	name: string;
	polecats: string[];
	crews: string[] | null;
	agents: GtStatusAgent[];
}

interface GtStatus {
	agents: GtStatusAgent[];
	rigs: GtStatusRig[];
}

export interface AgentAddress {
	address: string;
	label: string;
	role: string;
	rig?: string;
}

/**
 * Build list of available agent addresses from gt status
 */
function buildAddressList(status: GtStatus): AgentAddress[] {
	const addresses: AgentAddress[] = [];

	// Top-level agents (mayor, deacon)
	for (const agent of status.agents) {
		addresses.push({
			address: agent.address,
			label: agent.name.charAt(0).toUpperCase() + agent.name.slice(1),
			role: agent.role
		});
	}

	// Rig-level agents
	for (const rig of status.rigs) {
		for (const agent of rig.agents) {
			const roleSuffix = agent.role !== 'polecat' && agent.role !== 'crew'
				? ` (${agent.role})`
				: '';
			addresses.push({
				address: agent.address,
				label: `${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}${roleSuffix}`,
				role: agent.role,
				rig: rig.name
			});
		}
	}

	// Sort: coordinators first, then alphabetically by address
	return addresses.sort((a, b) => {
		const roleOrder: Record<string, number> = {
			coordinator: 0,
			'health-check': 1,
			witness: 2,
			refinery: 3,
			polecat: 4,
			crew: 5
		};
		const aOrder = roleOrder[a.role] ?? 99;
		const bOrder = roleOrder[b.role] ?? 99;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return a.address.localeCompare(b.address);
	});
}

export const load: PageServerLoad = async ({ url }) => {
	// Check for pre-filled recipient from query params
	const prefillTo = url.searchParams.get('to') ?? '';
	const prefillSubject = url.searchParams.get('subject') ?? '';

	try {
		const { stdout } = await execGt('gt status --json', {
			timeout: 5000
		});

		const status: GtStatus = JSON.parse(stdout);
		const addresses = buildAddressList(status);

		return {
			addresses,
			prefillTo,
			prefillSubject,
			error: null
		};
	} catch (err) {
		console.error('Failed to fetch agent list:', err);

		return {
			addresses: [],
			prefillTo,
			prefillSubject,
			error: 'Failed to load agent addresses'
		};
	}
};

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const to = data.get('to')?.toString().trim() ?? '';
		const subject = data.get('subject')?.toString().trim() ?? '';
		const body = data.get('body')?.toString() ?? '';

		// Validation
		if (!to) {
			return fail(400, { to, subject, body, error: 'Recipient address is required' });
		}
		if (!subject) {
			return fail(400, { to, subject, body, error: 'Subject is required' });
		}
		if (!body) {
			return fail(400, { to, subject, body, error: 'Message body is required' });
		}

		try {
			// Use spawn with argument array to avoid shell injection
			// No escaping needed - arguments passed directly to process
			await spawnAsync('gt', ['mail', 'send', to, '-s', subject, '-m', body], {
				timeout: 10000
			});
			// Redirect to inbox on success
			redirect(303, '/mail?sent=1');
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			console.error('Failed to send mail:', errorMessage);
			return fail(500, {
				to,
				subject,
				body,
				error: `Failed to send mail: ${errorMessage}`
			});
		}
	}
};
