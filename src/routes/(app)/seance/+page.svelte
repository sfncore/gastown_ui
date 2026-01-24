<script lang="ts">
	import { GridPattern } from '$lib/components';
	import { SeanceControls, SeanceHistory } from '$lib/components/seance';
	import type { Session } from '$lib/components/seance';

	let { data } = $props();

	function exportSession(session: Session) {
		const content = JSON.stringify(session, null, 2);
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `session-${session.id}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function resumeSession(session: Session) {
		// Mock resume action - would actually reinitialize the agent
		alert(`Resuming session ${session.id} for ${session.agentName}...`);
	}

	function deleteSession(session: Session) {
		// Mock delete action - would actually delete from storage
		if (confirm(`Delete session ${session.id}? This cannot be undone.`)) {
			alert(`Session ${session.id} deleted.`);
		}
	}

	const hasFilters = $derived(
		Boolean(
			data.filters.agent ||
				data.filters.rig ||
				data.filters.status ||
				data.filters.search ||
				data.filters.dateFrom ||
				data.filters.dateTo
		)
	);
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.03} />

	<div class="relative z-10 flex flex-col min-h-screen">
		<SeanceControls
			sessionCount={data.sessions.length}
			agents={data.agents}
			rigs={data.rigs}
			statuses={data.statuses}
			filters={data.filters}
		/>

		<!-- Session list -->
		<main class="flex-1 container py-4">
			<SeanceHistory
				sessions={data.sessions}
				{hasFilters}
				error={data.error}
				onExportSession={exportSession}
				onResumeSession={resumeSession}
				onDeleteSession={deleteSession}
			/>
		</main>
	</div>
</div>
