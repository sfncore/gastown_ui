<script lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils';

	/**
	 * GridPattern variant definitions using tailwind-variants
	 */
	const gridPatternVariants = tv({
		base: 'absolute inset-0 pointer-events-none z-0',
		variants: {
			variant: {
				dots: '',
				lines: ''
			},
			pulse: {
				true: 'animate-grid-pulse',
				false: ''
			}
		},
		defaultVariants: {
			variant: 'dots',
			pulse: false
		}
	});

	/**
	 * Props type derived from variant definitions
	 */
	export type GridPatternProps = VariantProps<typeof gridPatternVariants> & {
		class?: string;
		opacity?: number;
		color?: string;
	};

	// Component props
	let {
		variant = 'dots',
		pulse = false,
		opacity = 0.3,
		color = 'currentColor',
		class: className = ''
	}: GridPatternProps = $props();

	// Pattern IDs for SVG references
	const patternId = $derived(`grid-pattern-${variant}-${Math.random().toString(36).slice(2, 9)}`);
</script>

<div class={cn(gridPatternVariants({ variant, pulse }), className)} style="opacity: {opacity};">
	<svg
		class="h-full w-full"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<defs>
			{#if variant === 'dots'}
				<pattern
					id={patternId}
					width="24"
					height="24"
					patternUnits="userSpaceOnUse"
				>
					<circle cx="2" cy="2" r="1" fill={color} />
				</pattern>
			{:else if variant === 'lines'}
				<pattern
					id={patternId}
					width="24"
					height="24"
					patternUnits="userSpaceOnUse"
				>
					<path
						d="M 24 0 L 0 0 0 24"
						fill="none"
						stroke={color}
						stroke-width="0.5"
					/>
				</pattern>
			{/if}
		</defs>
		<rect width="100%" height="100%" fill="url(#{patternId})" />
	</svg>
</div>
