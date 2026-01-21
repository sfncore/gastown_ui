<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils';
	import type { ToastType } from '$lib/stores';
	import { MessageCircle, Info, CheckCircle, AlertTriangle, XCircle, X, Loader2 } from 'lucide-svelte';
	import type { ComponentType } from 'svelte';

	/**
	 * Toast variant definitions using tailwind-variants
	 * Follows shadcn toast pattern with --background/--foreground tokens
	 */
	const toastVariants = tv({
		slots: {
			container: [
				'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
				'border backdrop-blur-sm',
				'min-w-[280px] max-w-[400px]',
				// Animation: slide-in-from-bottom with fade
				'animate-in slide-in-from-bottom-5 fade-in-0 duration-300'
			],
			icon: 'w-5 h-5 flex-shrink-0',
			content: 'flex-1 text-sm font-medium',
			dismiss: [
				'p-2.5 -m-1 rounded-md transition-colors',
				'hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				'touch-target-interactive'
			]
		},
		variants: {
			type: {
				// Default variant uses standard background/foreground tokens
				default: {
					container: 'bg-background text-foreground border-border',
					icon: 'text-foreground'
				},
				info: {
					container: 'bg-background text-foreground border-primary/30',
					icon: 'text-primary'
				},
				success: {
					container: 'bg-background text-foreground border-success/30',
					icon: 'text-success'
				},
				warning: {
					container: 'bg-background text-foreground border-warning/30',
					icon: 'text-warning'
				},
				error: {
					container: 'bg-destructive text-destructive-foreground border-destructive/20',
					icon: 'text-destructive-foreground'
				},
				progress: {
					container: 'bg-background text-foreground border-primary/30',
					icon: 'text-primary animate-spin'
				}
			}
		},
		defaultVariants: {
			type: 'default'
		}
	});

	type ToastVariants = VariantProps<typeof toastVariants>;

	interface Props {
		id: string;
		type?: ToastType;
		message: string;
		dismissible?: boolean;
		dismissing?: boolean;
		onDismiss?: (id: string) => void;
		class?: string;
	}

	let {
		id,
		type = 'default',
		message,
		dismissible = true,
		dismissing = false,
		onDismiss,
		class: className = ''
	}: Props = $props();

	// Make variants reactive to type changes
	const styles = $derived(toastVariants({ type }));

	function handleDismiss() {
		onDismiss?.(id);
	}

	// Lucide icon components for each type
	const icons: Record<ToastType, ComponentType> = {
		default: MessageCircle,
		info: Info,
		success: CheckCircle,
		warning: AlertTriangle,
		error: XCircle,
		progress: Loader2
	};

	const IconComponent = $derived(icons[type ?? 'default']);
</script>

<div
	class={cn(
		styles.container(),
		dismissing && 'animate-slide-out-right',
		className
	)}
	role="alert"
	aria-live={type === 'error' ? 'assertive' : 'polite'}
	data-testid="toast"
>
	<IconComponent class={styles.icon()} aria-hidden="true" />

	<span class={styles.content()} data-testid="toast-message">{message}</span>

	{#if dismissible}
		<button
			type="button"
			class={styles.dismiss()}
			onclick={handleDismiss}
			aria-label="Dismiss notification"
			data-testid="toast-action"
		>
			<X class="w-4 h-4" />
		</button>
	{/if}
</div>
