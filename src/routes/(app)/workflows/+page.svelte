<script lang="ts">
	import { DashboardLayout } from '$lib/components';
	import { WorkflowFilters, WorkflowList, WorkflowDetail } from '$lib/components/workflows';
	import type {
		Formula,
		FormulaDetail,
		MoleculesResponse,
		TabId,
		ActionMessage
	} from '$lib/components/workflows';
	import { onMount } from 'svelte';

	// Tab state
	let activeTab = $state<TabId>('molecules');

	// Data state
	let formulas = $state<Formula[]>([]);
	let molecules = $state<MoleculesResponse | null>(null);
	let loadingFormulas = $state(true);
	let loadingMolecules = $state(true);
	let error = $state<string | null>(null);

	// Formula detail state
	let selectedFormula = $state<FormulaDetail | null>(null);
	let loadingDetail = $state(false);
	let detailError = $state<string | null>(null);

	// Action state
	let cookLoading = $state(false);
	let pourLoading = $state(false);
	let actionMessage = $state<ActionMessage | null>(null);
	let varInputs = $state<Record<string, string>>({});

	// --- Data fetching ---

	async function fetchFormulas() {
		try {
			const res = await fetch('/api/gastown/workflows/formulas');
			if (!res.ok) throw new Error('Failed to fetch formulas');
			formulas = await res.json();
		} catch (e) {
			console.error('Error fetching formulas:', e);
			error = e instanceof Error ? e.message : 'Failed to fetch formulas';
		} finally {
			loadingFormulas = false;
		}
	}

	async function fetchMolecules() {
		try {
			const res = await fetch('/api/gastown/workflows/molecules');
			if (!res.ok) throw new Error('Failed to fetch molecules');
			molecules = await res.json();
		} catch (e) {
			console.error('Error fetching molecules:', e);
		} finally {
			loadingMolecules = false;
		}
	}

	async function fetchFormulaDetail(name: string) {
		loadingDetail = true;
		detailError = null;
		selectedFormula = null;
		varInputs = {};

		try {
			const res = await fetch(`/api/gastown/workflows/formulas/${encodeURIComponent(name)}`);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to fetch formula details');
			}
			selectedFormula = await res.json();

			// Initialize var inputs with defaults
			if (selectedFormula?.variables) {
				for (const v of selectedFormula.variables) {
					varInputs[v.name] = v.default || '';
				}
			}
		} catch (e) {
			console.error('Error fetching formula detail:', e);
			detailError = e instanceof Error ? e.message : 'Failed to fetch formula details';
		} finally {
			loadingDetail = false;
		}
	}

	// --- Actions ---

	async function handleCook(dryRun: boolean) {
		if (!selectedFormula) return;

		cookLoading = true;
		actionMessage = null;

		try {
			const res = await fetch('/api/gastown/workflows/cook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formula: selectedFormula.name,
					vars: varInputs,
					dryRun
				})
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.error || 'Failed to cook formula');
			}

			actionMessage = {
				type: 'success',
				text: dryRun ? 'Dry run complete - check console for output' : 'Formula cooked successfully'
			};
		} catch (e) {
			actionMessage = {
				type: 'error',
				text: e instanceof Error ? e.message : 'Failed to cook formula'
			};
		} finally {
			cookLoading = false;
		}
	}

	async function handlePour() {
		if (!selectedFormula) return;

		pourLoading = true;
		actionMessage = null;

		try {
			const res = await fetch('/api/gastown/workflows/pour', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					proto: selectedFormula.name,
					vars: varInputs
				})
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.error || 'Failed to pour molecule');
			}

			actionMessage = {
				type: 'success',
				text: `Molecule poured${data.molId ? `: ${data.molId}` : ''}`
			};

			// Refresh molecules list
			await fetchMolecules();
		} catch (e) {
			actionMessage = {
				type: 'error',
				text: e instanceof Error ? e.message : 'Failed to pour molecule'
			};
		} finally {
			pourLoading = false;
		}
	}

	function handleCloseDetail() {
		selectedFormula = null;
		detailError = null;
		actionMessage = null;
		varInputs = {};
	}

	function handleVarChange(name: string, value: string) {
		varInputs[name] = value;
	}

	function handleTabChange(tab: TabId) {
		activeTab = tab;
	}

	onMount(() => {
		fetchFormulas();
		fetchMolecules();
	});
</script>

<DashboardLayout title="Workflows" systemStatus="running">
	{#snippet stats()}
		<WorkflowFilters
			{activeTab}
			onTabChange={handleTabChange}
			{loadingFormulas}
			{loadingMolecules}
			{formulas}
			{molecules}
		/>
	{/snippet}

	<WorkflowList
		{activeTab}
		{loadingFormulas}
		{loadingMolecules}
		{formulas}
		{molecules}
		{error}
		onFormulaSelect={fetchFormulaDetail}
	/>
</DashboardLayout>

<WorkflowDetail
	{selectedFormula}
	{loadingDetail}
	{detailError}
	{actionMessage}
	{cookLoading}
	{pourLoading}
	{varInputs}
	onClose={handleCloseDetail}
	onCook={handleCook}
	onPour={handlePour}
	onVarChange={handleVarChange}
/>
