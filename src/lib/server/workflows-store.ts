/**
 * Workflows Store
 *
 * In-memory store for tracking multi-step workflows.
 */

export type WorkflowType = 'merge-deploy' | 'test-merge' | 'full-ci' | 'custom';
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
	id: string;
	name: string;
	status: StepStatus;
	duration?: number;
	output?: unknown;
	error?: string;
	startedAt?: string;
	completedAt?: string;
}

export interface Workflow {
	id: string;
	name: string;
	type: WorkflowType;
	status: WorkflowStatus;
	steps: WorkflowStep[];
	createdAt: string;
	completedAt: string | null;
	params: Record<string, unknown>;
}

class WorkflowsStore {
	private workflows = new Map<string, Workflow>();

	generateId(): string {
		return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	create(type: WorkflowType, name: string, params: Record<string, unknown> = {}): Workflow {
		const id = this.generateId();

		const defaultSteps: Record<WorkflowType, string[]> = {
			'merge-deploy': ['checkout', 'test', 'merge', 'deploy'],
			'test-merge': ['checkout', 'test', 'merge'],
			'full-ci': ['checkout', 'lint', 'test', 'build', 'deploy'],
			custom: []
		};

		const stepNames = defaultSteps[type] || [];
		const steps: WorkflowStep[] = stepNames.map((stepName, idx) => ({
			id: `step-${idx + 1}`,
			name: stepName,
			status: 'pending' as StepStatus
		}));

		const workflow: Workflow = {
			id,
			name: name || type,
			type,
			status: 'pending',
			steps,
			createdAt: new Date().toISOString(),
			completedAt: null,
			params
		};

		this.workflows.set(id, workflow);
		return workflow;
	}

	get(id: string): Workflow | undefined {
		return this.workflows.get(id);
	}

	list(filters?: { status?: WorkflowStatus; type?: WorkflowType }): Workflow[] {
		let wfs = Array.from(this.workflows.values());

		if (filters?.status) {
			wfs = wfs.filter((wf) => wf.status === filters.status);
		}
		if (filters?.type) {
			wfs = wfs.filter((wf) => wf.type === filters.type);
		}

		return wfs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}

	updateStatus(id: string, status: WorkflowStatus): boolean {
		const wf = this.workflows.get(id);
		if (!wf) return false;

		wf.status = status;
		if (status === 'completed' || status === 'failed' || status === 'cancelled') {
			wf.completedAt = new Date().toISOString();
		}

		return true;
	}

	updateStep(
		workflowId: string,
		stepId: string,
		updates: Partial<Pick<WorkflowStep, 'status' | 'output' | 'error' | 'duration'>>
	): boolean {
		const wf = this.workflows.get(workflowId);
		if (!wf) return false;

		const step = wf.steps.find((s) => s.id === stepId);
		if (!step) return false;

		if (updates.status !== undefined) {
			step.status = updates.status;
			if (updates.status === 'running') {
				step.startedAt = new Date().toISOString();
			}
			if (updates.status === 'completed' || updates.status === 'failed') {
				step.completedAt = new Date().toISOString();
			}
		}
		if (updates.output !== undefined) step.output = updates.output;
		if (updates.error !== undefined) step.error = updates.error;
		if (updates.duration !== undefined) step.duration = updates.duration;

		return true;
	}

	retryStep(workflowId: string, stepId: string): { success: boolean; error?: string } {
		const wf = this.workflows.get(workflowId);
		if (!wf) return { success: false, error: 'Workflow not found' };

		const step = wf.steps.find((s) => s.id === stepId);
		if (!step) return { success: false, error: 'Step not found' };

		if (step.status !== 'failed') {
			return { success: false, error: 'Can only retry failed steps' };
		}

		step.status = 'pending';
		step.error = undefined;
		step.output = undefined;
		step.startedAt = undefined;
		step.completedAt = undefined;
		step.duration = undefined;

		if (wf.status === 'failed') {
			wf.status = 'running';
			wf.completedAt = null;
		}

		return { success: true };
	}
}

export const workflowsStore = new WorkflowsStore();
