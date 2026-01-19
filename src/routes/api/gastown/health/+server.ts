import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcessSupervisor } from '$lib/server/cli';
import { randomUUID } from 'node:crypto';

interface HealthCheck {
	name: string;
	status: 'pass' | 'warn' | 'fail';
	message: string;
	category: string;
}

interface HealthResponse {
	status: 'healthy' | 'degraded' | 'unhealthy';
	checks: HealthCheck[];
	timestamp: string;
	summary: {
		total: number;
		pass: number;
		warn: number;
		fail: number;
	};
	requestId: string;
}

let cachedResponse: HealthResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

function parseDoctorOutput(output: string): HealthCheck[] {
	const checks: HealthCheck[] = [];
	let currentCategory = 'UNKNOWN';

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

function computeOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
	const hasFail = checks.some((c) => c.status === 'fail');
	const hasWarn = checks.some((c) => c.status === 'warn');

	if (hasFail) return 'unhealthy';
	if (hasWarn) return 'degraded';
	return 'healthy';
}

export const GET: RequestHandler = async () => {
	const requestId = randomUUID();
	const now = Date.now();

	if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
		return json({ ...cachedResponse, requestId });
	}

	const supervisor = getProcessSupervisor();

	const result = await supervisor.gt<string>(['doctor'], { timeout: 30_000 });

	if (!result.success) {
		const fallbackResponse: HealthResponse = {
			status: 'unhealthy',
			checks: [
				{
					name: 'gt-doctor',
					status: 'fail',
					message: result.error || 'Failed to run health check',
					category: 'SYSTEM'
				}
			],
			timestamp: new Date().toISOString(),
			summary: { total: 1, pass: 0, warn: 0, fail: 1 },
			requestId
		};

		return json(fallbackResponse, { status: 503 });
	}

	const output = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
	const checks = parseDoctorOutput(output);
	const overallStatus = computeOverallStatus(checks);

	const response: HealthResponse = {
		status: overallStatus,
		checks,
		timestamp: new Date().toISOString(),
		summary: {
			total: checks.length,
			pass: checks.filter((c) => c.status === 'pass').length,
			warn: checks.filter((c) => c.status === 'warn').length,
			fail: checks.filter((c) => c.status === 'fail').length
		},
		requestId
	};

	cachedResponse = response;
	cacheTimestamp = now;

	const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
	return json(response, { status: httpStatus });
};
