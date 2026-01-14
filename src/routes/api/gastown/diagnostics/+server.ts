/**
 * Diagnostics API Endpoint
 *
 * Returns health check results from gt doctor.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface DiagnosticCheck {
	name: string;
	status: 'pass' | 'warn' | 'fail';
	message: string;
	category: string;
}

interface DiagnosticsResponse {
	checks: DiagnosticCheck[];
	overallStatus: 'pass' | 'warn' | 'fail';
	categories: string[];
	summary: {
		total: number;
		pass: number;
		warn: number;
		fail: number;
	};
	timestamp: string;
}

function parseDoctorOutput(output: string): DiagnosticCheck[] {
	const checks: DiagnosticCheck[] = [];
	let currentCategory = 'GENERAL';

	const lines = output.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		if (/^[A-Z]+$/.test(trimmed)) {
			currentCategory = trimmed;
			continue;
		}

		const passMatch = trimmed.match(/^✓\s+(\S+)\s+(.*)$/);
		if (passMatch) {
			checks.push({
				name: passMatch[1],
				status: 'pass',
				message: passMatch[2],
				category: currentCategory
			});
			continue;
		}

		const warnMatch = trimmed.match(/^⚠\s+(\S+)\s+(.*)$/);
		if (warnMatch) {
			checks.push({
				name: warnMatch[1],
				status: 'warn',
				message: warnMatch[2],
				category: currentCategory
			});
			continue;
		}

		const failMatch = trimmed.match(/^✗\s+(\S+)\s+(.*)$/);
		if (failMatch) {
			checks.push({
				name: failMatch[1],
				status: 'fail',
				message: failMatch[2],
				category: currentCategory
			});
		}
	}

	return checks;
}

function computeOverallStatus(checks: DiagnosticCheck[]): 'pass' | 'warn' | 'fail' {
	if (checks.some((c) => c.status === 'fail')) return 'fail';
	if (checks.some((c) => c.status === 'warn')) return 'warn';
	return 'pass';
}

let cachedResponse: DiagnosticsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export const GET: RequestHandler = async ({ url }) => {
	const now = Date.now();
	const forceRefresh = url.searchParams.get('refresh') === 'true';

	if (!forceRefresh && cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
		return json(cachedResponse);
	}

	try {
		const { stdout, stderr } = await execAsync('gt doctor', {
			timeout: 30_000,
			maxBuffer: 2 * 1024 * 1024
		});

		const output = stdout || stderr;
		const checks = parseDoctorOutput(output);
		const overallStatus = computeOverallStatus(checks);
		const categories = [...new Set(checks.map((c) => c.category))];

		const response: DiagnosticsResponse = {
			checks,
			overallStatus,
			categories,
			summary: {
				total: checks.length,
				pass: checks.filter((c) => c.status === 'pass').length,
				warn: checks.filter((c) => c.status === 'warn').length,
				fail: checks.filter((c) => c.status === 'fail').length
			},
			timestamp: new Date().toISOString()
		};

		cachedResponse = response;
		cacheTimestamp = now;

		return json(response);
	} catch (error) {
		console.error('Failed to run diagnostics:', error);

		const fallbackResponse: DiagnosticsResponse = {
			checks: [
				{
					name: 'gt-doctor',
					status: 'fail',
					message: error instanceof Error ? error.message : 'Failed to run diagnostics',
					category: 'SYSTEM'
				}
			],
			overallStatus: 'fail',
			categories: ['SYSTEM'],
			summary: { total: 1, pass: 0, warn: 0, fail: 1 },
			timestamp: new Date().toISOString()
		};

		return json(fallbackResponse, { status: 503 });
	}
};
