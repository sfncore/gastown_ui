/**
 * Toast notification store using Svelte 5 runes
 *
 * Manages toast notifications with:
 * - Multiple toast types (info, success, warning, error)
 * - Auto-dismiss with configurable duration
 * - Queue management with max visible limit
 */

export type ToastType = 'default' | 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
	dismissible: boolean;
	timestamp: number;
	/** Set to true when toast is animating out */
	dismissing?: boolean;
	/** Extracted bead ID from message (pattern: [a-z]+-[a-z0-9]+) */
	beadId?: string;
}

export interface ToastOptions {
	type?: ToastType;
	duration?: number;
	dismissible?: boolean;
	/** Optional bead ID to associate with the toast */
	beadId?: string;
}

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 3;
const EXIT_ANIMATION_DURATION = 200;
/** Pattern to extract bead IDs from messages */
const BEAD_ID_PATTERN = /([a-z]+-[a-z0-9]+)/;

/**
 * Extract bead ID from a message string
 */
function extractBeadId(message: string): string | undefined {
	const match = message.match(BEAD_ID_PATTERN);
	return match?.[1];
}

class ToastStore {
	#toasts = $state<Toast[]>([]);
	#timeouts = new Map<string, ReturnType<typeof setTimeout>>();

	get toasts() {
		return this.#toasts;
	}

	get count() {
		return this.#toasts.length;
	}

	/**
	 * Show a toast notification
	 */
	show(message: string, options: ToastOptions = {}) {
		// Extract bead ID from message if not explicitly provided
		const beadId = options.beadId ?? extractBeadId(message);

		const toast: Toast = {
			id: crypto.randomUUID(),
			message,
			type: options.type ?? 'default',
			duration: options.duration ?? DEFAULT_DURATION,
			dismissible: options.dismissible ?? true,
			timestamp: Date.now(),
			beadId
		};

		// Remove oldest if at max
		if (this.#toasts.length >= MAX_TOASTS) {
			const oldest = this.#toasts[0];
			this.dismiss(oldest.id);
		}

		this.#toasts = [...this.#toasts, toast];

		// Auto-dismiss after duration
		if (toast.duration > 0) {
			const timeout = setTimeout(() => {
				this.dismiss(toast.id);
			}, toast.duration);
			this.#timeouts.set(toast.id, timeout);
		}

		return toast.id;
	}

	/**
	 * Convenience methods for different toast types
	 */
	info(message: string, options: Omit<ToastOptions, 'type'> = {}) {
		return this.show(message, { ...options, type: 'info' });
	}

	success(message: string, options: Omit<ToastOptions, 'type'> = {}) {
		return this.show(message, { ...options, type: 'success' });
	}

	warning(message: string, options: Omit<ToastOptions, 'type'> = {}) {
		return this.show(message, { ...options, type: 'warning' });
	}

	error(message: string, options: Omit<ToastOptions, 'type'> = {}) {
		return this.show(message, { ...options, type: 'error' });
	}

	/**
	 * Show a progress toast with indeterminate indicator
	 * Progress toasts don't auto-dismiss and are not dismissible by default
	 * @returns A function to dismiss the progress toast
	 */
	progress(message: string, options: Omit<ToastOptions, 'type'> = {}) {
		const id = this.show(message, {
			...options,
			type: 'progress',
			duration: 0, // Don't auto-dismiss
			dismissible: options.dismissible ?? false
		});
		return () => this.dismiss(id);
	}

	/**
	 * Two-phase feedback pattern for async operations
	 * Phase 1: Shows progress toast immediately
	 * Phase 2: Call the returned function with result to show success/error
	 *
	 * @example
	 * const complete = toast.async("Adding rig...");
	 * try {
	 *   const result = await addRig();
	 *   complete.success("Added: zoo-game", { beadId: "gu-123" });
	 * } catch (e) {
	 *   complete.error("Failed to add rig");
	 * }
	 */
	async(progressMessage: string, options: Omit<ToastOptions, 'type'> = {}) {
		const dismissProgress = this.progress(progressMessage, options);

		return {
			success: (message: string, resultOptions: Omit<ToastOptions, 'type'> = {}) => {
				dismissProgress();
				return this.success(message, resultOptions);
			},
			error: (message: string, resultOptions: Omit<ToastOptions, 'type'> = {}) => {
				dismissProgress();
				return this.error(message, resultOptions);
			},
			warning: (message: string, resultOptions: Omit<ToastOptions, 'type'> = {}) => {
				dismissProgress();
				return this.warning(message, resultOptions);
			},
			info: (message: string, resultOptions: Omit<ToastOptions, 'type'> = {}) => {
				dismissProgress();
				return this.info(message, resultOptions);
			},
			dismiss: dismissProgress
		};
	}

	/**
	 * Dismiss a specific toast with exit animation
	 */
	dismiss(id: string) {
		// Clear auto-dismiss timeout if exists
		const timeout = this.#timeouts.get(id);
		if (timeout) {
			clearTimeout(timeout);
			this.#timeouts.delete(id);
		}

		// Mark as dismissing to trigger exit animation
		this.#toasts = this.#toasts.map((t) =>
			t.id === id ? { ...t, dismissing: true } : t
		);

		// Remove after animation completes
		setTimeout(() => {
			this.#toasts = this.#toasts.filter((t) => t.id !== id);
		}, EXIT_ANIMATION_DURATION);
	}

	/**
	 * Dismiss all toasts
	 */
	dismissAll() {
		// Clear all timeouts
		for (const timeout of this.#timeouts.values()) {
			clearTimeout(timeout);
		}
		this.#timeouts.clear();

		this.#toasts = [];
	}
}

// Singleton instance
export const toastStore = new ToastStore();
