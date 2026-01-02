<script lang="ts">
	/**
	 * Number Counter Component
	 *
	 * Animated number display with smooth transitions using Svelte tweened stores.
	 * Supports integer, decimal, and percentage formats.
	 *
	 * @example
	 * <NumberCounter value={1234} />
	 * <NumberCounter value={99.5} format="percentage" duration={1000} />
	 * <NumberCounter value={3.14159} format="decimal" variant="accent" />
	 */
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { cn } from '$lib/utils';

	type Format = 'integer' | 'decimal' | 'percentage';
	type Variant = 'default' | 'accent';

	interface Props {
		/** The target number to display */
		value: number;
		/** Animation duration in milliseconds */
		duration?: number;
		/** Number format */
		format?: Format;
		/** Color variant */
		variant?: Variant;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		value,
		duration = 500,
		format = 'integer',
		variant = 'default',
		class: className
	}: Props = $props();

	// Create tweened store with animation settings
	const displayValue = tweened(0, {
		duration,
		easing: cubicOut
	});

	// Update tweened value when prop changes
	$effect(() => {
		displayValue.set(value);
	});

	// Format the displayed number based on format prop
	const formattedValue = $derived.by(() => {
		const current = $displayValue;

		switch (format) {
			case 'percentage':
				return `${current.toFixed(1)}%`;
			case 'decimal':
				return current.toFixed(2);
			case 'integer':
			default:
				return Math.round(current).toLocaleString();
		}
	});

	// Build class string
	const classes = $derived(
		cn(
			'font-mono tabular-nums',
			variant === 'accent' ? 'text-accent' : 'text-foreground',
			className
		)
	);
</script>

<span class={classes} aria-live="polite" aria-atomic="true">
	{formattedValue}
</span>
