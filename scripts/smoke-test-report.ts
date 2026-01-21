#!/usr/bin/env bun

/**
 * Smoke Test Report Generator
 *
 * Generates a formatted report from smoke test results.
 * Can read results from stdin (piped) or run tests directly.
 *
 * Usage:
 *   OUTPUT_JSON=true bun scripts/smoke-test.ts 2>&1 | bun scripts/smoke-test-report.ts
 *   bun scripts/smoke-test-report.ts --run
 *
 * @module scripts/smoke-test-report
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

interface TestResult {
	name: string;
	cuj: string;
	passed: boolean;
	duration: number;
	error?: string;
	response?: {
		status: number;
		body: unknown;
	};
}

interface TestReport {
	timestamp: string;
	baseUrl: string;
	duration: number;
	summary: {
		total: number;
		passed: number;
		failed: number;
	};
	cujSummary: Record<string, { passed: number; failed: number }>;
	results: TestResult[];
}

/**
 * Run smoke tests and capture JSON output
 */
async function runSmokeTests(baseUrl?: string): Promise<TestReport | null> {
	return new Promise((resolve) => {
		const env = {
			...process.env,
			OUTPUT_JSON: 'true',
			...(baseUrl ? { BASE_URL: baseUrl } : {})
		};

		const proc = spawn('bun', ['scripts/smoke-test.ts'], {
			env,
			cwd: process.cwd(),
			stdio: ['inherit', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		proc.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', () => {
			// Extract JSON from output
			const jsonMatch = stdout.match(/--- JSON REPORT ---\n([\s\S]+)/);
			if (jsonMatch) {
				try {
					const report = JSON.parse(jsonMatch[1].trim()) as TestReport;
					resolve(report);
					return;
				} catch {
					console.error('Failed to parse JSON report');
				}
			}

			// If we couldn't get JSON, return null
			resolve(null);
		});
	});
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: TestReport): string {
	const lines: string[] = [];

	lines.push('# Smoke Test Report');
	lines.push('');
	lines.push(`**Timestamp:** ${report.timestamp}`);
	lines.push(`**Target:** ${report.baseUrl}`);
	lines.push(`**Duration:** ${report.duration}ms`);
	lines.push('');

	// Summary
	lines.push('## Summary');
	lines.push('');
	lines.push(`| Metric | Value |`);
	lines.push(`|--------|-------|`);
	lines.push(`| Total Tests | ${report.summary.total} |`);
	lines.push(`| Passed | ${report.summary.passed} |`);
	lines.push(`| Failed | ${report.summary.failed} |`);
	lines.push(`| Pass Rate | ${((report.summary.passed / report.summary.total) * 100).toFixed(1)}% |`);
	lines.push('');

	// CUJ Summary
	lines.push('## CUJ Summary');
	lines.push('');
	lines.push('| CUJ | Passed | Failed | Status |');
	lines.push('|-----|--------|--------|--------|');

	for (const [cuj, stats] of Object.entries(report.cujSummary)) {
		const status = stats.failed === 0 ? '✅' : '❌';
		lines.push(`| ${cuj} | ${stats.passed} | ${stats.failed} | ${status} |`);
	}
	lines.push('');

	// Detailed Results
	lines.push('## Detailed Results');
	lines.push('');

	const groupedResults = new Map<string, TestResult[]>();
	for (const result of report.results) {
		const existing = groupedResults.get(result.cuj) || [];
		existing.push(result);
		groupedResults.set(result.cuj, existing);
	}

	for (const [cuj, results] of groupedResults) {
		lines.push(`### ${cuj}`);
		lines.push('');
		lines.push('| Test | Duration | Status |');
		lines.push('|------|----------|--------|');

		for (const result of results) {
			const status = result.passed ? '✅ Pass' : `❌ Fail: ${result.error || 'Unknown'}`;
			lines.push(`| ${result.name} | ${result.duration}ms | ${status} |`);
		}
		lines.push('');
	}

	// Failed Tests Detail
	const failedTests = report.results.filter((r) => !r.passed);
	if (failedTests.length > 0) {
		lines.push('## Failed Tests Detail');
		lines.push('');

		for (const test of failedTests) {
			lines.push(`### ${test.cuj}: ${test.name}`);
			lines.push('');
			lines.push(`**Error:** ${test.error || 'Unknown error'}`);
			lines.push('');

			if (test.response) {
				lines.push('**Response:**');
				lines.push('```json');
				lines.push(JSON.stringify(test.response, null, 2));
				lines.push('```');
				lines.push('');
			}
		}
	}

	return lines.join('\n');
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report: TestReport): string {
	const passRate = ((report.summary.passed / report.summary.total) * 100).toFixed(1);
	const statusColor = report.summary.failed === 0 ? '#22c55e' : '#ef4444';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Smoke Test Report - ${report.timestamp}</title>
	<style>
		:root {
			--bg: #0f172a;
			--surface: #1e293b;
			--border: #334155;
			--text: #f1f5f9;
			--text-muted: #94a3b8;
			--green: #22c55e;
			--red: #ef4444;
			--yellow: #eab308;
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: system-ui, -apple-system, sans-serif;
			background: var(--bg);
			color: var(--text);
			line-height: 1.5;
			padding: 2rem;
		}
		.container { max-width: 1200px; margin: 0 auto; }
		h1 { font-size: 2rem; margin-bottom: 1rem; }
		h2 { font-size: 1.5rem; margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
		h3 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; }
		.meta { color: var(--text-muted); margin-bottom: 2rem; }
		.meta span { margin-right: 2rem; }
		.summary-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
			gap: 1rem;
			margin-bottom: 2rem;
		}
		.summary-card {
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: 0.5rem;
			padding: 1rem;
			text-align: center;
		}
		.summary-card .value {
			font-size: 2rem;
			font-weight: bold;
		}
		.summary-card .label { color: var(--text-muted); }
		.pass { color: var(--green); }
		.fail { color: var(--red); }
		table {
			width: 100%;
			border-collapse: collapse;
			background: var(--surface);
			border-radius: 0.5rem;
			overflow: hidden;
		}
		th, td {
			padding: 0.75rem 1rem;
			text-align: left;
			border-bottom: 1px solid var(--border);
		}
		th { background: rgba(0,0,0,0.2); color: var(--text-muted); font-weight: 500; }
		tr:last-child td { border-bottom: none; }
		.status-badge {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.25rem 0.5rem;
			border-radius: 0.25rem;
			font-size: 0.875rem;
		}
		.status-badge.pass { background: rgba(34, 197, 94, 0.2); color: var(--green); }
		.status-badge.fail { background: rgba(239, 68, 68, 0.2); color: var(--red); }
		.error-detail {
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: 0.5rem;
			padding: 1rem;
			margin: 1rem 0;
		}
		.error-detail pre {
			background: var(--bg);
			padding: 1rem;
			border-radius: 0.25rem;
			overflow-x: auto;
			font-size: 0.875rem;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🔥 Smoke Test Report</h1>
		<div class="meta">
			<span>📅 ${report.timestamp}</span>
			<span>🎯 ${report.baseUrl}</span>
			<span>⏱️ ${report.duration}ms</span>
		</div>

		<div class="summary-grid">
			<div class="summary-card">
				<div class="value">${report.summary.total}</div>
				<div class="label">Total Tests</div>
			</div>
			<div class="summary-card">
				<div class="value pass">${report.summary.passed}</div>
				<div class="label">Passed</div>
			</div>
			<div class="summary-card">
				<div class="value fail">${report.summary.failed}</div>
				<div class="label">Failed</div>
			</div>
			<div class="summary-card">
				<div class="value" style="color: ${statusColor}">${passRate}%</div>
				<div class="label">Pass Rate</div>
			</div>
		</div>

		<h2>CUJ Summary</h2>
		<table>
			<thead>
				<tr>
					<th>CUJ</th>
					<th>Passed</th>
					<th>Failed</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				${Object.entries(report.cujSummary)
					.map(
						([cuj, stats]) => `
					<tr>
						<td>${cuj}</td>
						<td class="pass">${stats.passed}</td>
						<td class="fail">${stats.failed}</td>
						<td><span class="status-badge ${stats.failed === 0 ? 'pass' : 'fail'}">${stats.failed === 0 ? '✓ Pass' : '✗ Fail'}</span></td>
					</tr>
				`
					)
					.join('')}
			</tbody>
		</table>

		<h2>Detailed Results</h2>
		<table>
			<thead>
				<tr>
					<th>CUJ</th>
					<th>Test</th>
					<th>Duration</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				${report.results
					.map(
						(r) => `
					<tr>
						<td>${r.cuj}</td>
						<td>${r.name}</td>
						<td>${r.duration}ms</td>
						<td><span class="status-badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? '✓ Pass' : '✗ Fail'}</span></td>
					</tr>
				`
					)
					.join('')}
			</tbody>
		</table>

		${
			report.results.filter((r) => !r.passed).length > 0
				? `
		<h2>Failed Tests Detail</h2>
		${report.results
			.filter((r) => !r.passed)
			.map(
				(r) => `
			<div class="error-detail">
				<h3>${r.cuj}: ${r.name}</h3>
				<p><strong>Error:</strong> ${r.error || 'Unknown error'}</p>
				${r.response ? `<pre>${JSON.stringify(r.response, null, 2)}</pre>` : ''}
			</div>
		`
			)
			.join('')}
		`
				: ''
		}
	</div>
</body>
</html>`;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const shouldRun = args.includes('--run');
	const outputDir = args.find((a) => a.startsWith('--output='))?.split('=')[1] || 'reports';
	const baseUrl = args.find((a) => a.startsWith('--url='))?.split('=')[1];
	const format = args.find((a) => a.startsWith('--format='))?.split('=')[1] || 'all';

	let report: TestReport | null = null;

	if (shouldRun) {
		console.log('Running smoke tests...');
		report = await runSmokeTests(baseUrl);
	} else {
		// Try to read from stdin (piped input)
		try {
			const input = readFileSync(0, 'utf-8');
			const jsonMatch = input.match(/--- JSON REPORT ---\n([\s\S]+)/);
			if (jsonMatch) {
				report = JSON.parse(jsonMatch[1].trim()) as TestReport;
			}
		} catch {
			console.log('No piped input detected. Use --run to execute tests.');
			console.log('');
			console.log('Usage:');
			console.log('  bun scripts/smoke-test-report.ts --run');
			console.log('  bun scripts/smoke-test-report.ts --run --url=http://localhost:3000');
			console.log('  bun scripts/smoke-test-report.ts --run --output=./reports --format=html');
			console.log('');
			console.log('Options:');
			console.log('  --run           Run smoke tests and generate report');
			console.log('  --url=URL       Override BASE_URL');
			console.log('  --output=DIR    Output directory (default: reports)');
			console.log('  --format=FMT    Output format: all, md, html, json (default: all)');
			process.exit(1);
		}
	}

	if (!report) {
		console.error('Failed to generate test report');
		process.exit(1);
	}

	// Ensure output directory exists
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	const timestamp = report.timestamp.replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];

	// Generate reports based on format
	if (format === 'all' || format === 'md') {
		const mdReport = generateMarkdownReport(report);
		const mdPath = join(outputDir, `smoke-test-${timestamp}.md`);
		writeFileSync(mdPath, mdReport);
		console.log(`Markdown report: ${mdPath}`);
	}

	if (format === 'all' || format === 'html') {
		const htmlReport = generateHtmlReport(report);
		const htmlPath = join(outputDir, `smoke-test-${timestamp}.html`);
		writeFileSync(htmlPath, htmlReport);
		console.log(`HTML report: ${htmlPath}`);
	}

	if (format === 'all' || format === 'json') {
		const jsonPath = join(outputDir, `smoke-test-${timestamp}.json`);
		writeFileSync(jsonPath, JSON.stringify(report, null, 2));
		console.log(`JSON report: ${jsonPath}`);
	}

	// Print quick summary
	console.log('');
	console.log(`Summary: ${report.summary.passed}/${report.summary.total} passed`);

	if (report.summary.failed > 0) {
		console.log(`Failed: ${report.summary.failed} tests`);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
