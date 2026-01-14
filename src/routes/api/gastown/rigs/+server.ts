import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execAsync = promisify(exec);

const AddRigSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.max(64, 'Name too long')
		.regex(/^[a-zA-Z0-9_-]+$/, 'Name must be alphanumeric with dashes/underscores'),
	url: z.string().url('Invalid URL').regex(/^https?:\/\//, 'Must be HTTP/HTTPS URL')
});

interface Operation {
	id: string;
	type: 'rig-add';
	status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	startedAt: string;
	completedAt?: string;
	logs: string[];
	error?: string;
	result?: unknown;
}

const operations = new Map<string, Operation>();

function generateOperationId(): string {
	return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function runRigAdd(operationId: string, name: string, url: string): void {
	const op = operations.get(operationId);
	if (!op) return;

	op.status = 'running';

	const proc = spawn('gt', ['rig', 'add', name, url], {
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout: 5 * 60 * 1000
	});

	proc.stdout?.on('data', (data: Buffer) => {
		op.logs.push(data.toString());
	});

	proc.stderr?.on('data', (data: Buffer) => {
		op.logs.push(`[stderr] ${data.toString()}`);
	});

	proc.on('close', (code) => {
		op.completedAt = new Date().toISOString();
		if (code === 0) {
			op.status = 'completed';
			op.result = { name, url };
		} else {
			op.status = 'failed';
			op.error = `Process exited with code ${code}`;
		}
	});

	proc.on('error', (err) => {
		op.completedAt = new Date().toISOString();
		op.status = 'failed';
		op.error = err.message;
	});
}

/** GET: List all rigs */
export const GET: RequestHandler = async () => {
	try {
		const { stdout } = await execAsync('gt rigs --json');
		const rigs = JSON.parse(stdout);
		return json(rigs);
	} catch (error) {
		console.error('Failed to fetch rigs:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch rigs' },
			{ status: 500 }
		);
	}
};

/** POST: Add a new rig (long-running operation) */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const parseResult = AddRigSchema.safeParse(body);
	if (!parseResult.success) {
		const errors = parseResult.error.flatten().fieldErrors;
		return json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { name, url } = parseResult.data;

	const operationId = generateOperationId();
	const operation: Operation = {
		id: operationId,
		type: 'rig-add',
		status: 'pending',
		startedAt: new Date().toISOString(),
		logs: []
	};

	operations.set(operationId, operation);

	setImmediate(() => runRigAdd(operationId, name, url));

	return json(
		{
			status: 'accepted',
			operationId,
			message: `Adding rig '${name}' from ${url}...`,
			checkStatus: `/api/gastown/operations/${operationId}`
		},
		{ status: 202 }
	);
};
