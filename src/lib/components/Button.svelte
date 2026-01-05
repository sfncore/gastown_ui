<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';
<<<<<<< HEAD

	/**
	 * Button variant definitions using tailwind-variants (shadcn pattern)
	 *
	 * Variants: default, destructive, outline, secondary, ghost, link
=======
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * Button variant definitions using tailwind-variants
	 * Follows shadcn/ui patterns: default, destructive, outline, secondary, ghost, link
>>>>>>> polecat/toast-mk1qtx0c
	 * Sizes: default (h-10), sm (h-9), lg (h-11), icon (h-10 w-10)
	 */
	export const buttonVariants = tv({
		base: [
<<<<<<< HEAD
			'inline-flex items-center justify-center gap-2 whitespace-nowrap',
			'font-medium text-sm',
			'rounded-md',
			'ring-offset-background transition-colors duration-150',
=======
			'inline-flex items-center justify-center gap-2',
			'whitespace-nowrap font-medium text-sm',
			'rounded-md',
			'transition-colors duration-150',
>>>>>>> polecat/toast-mk1qtx0c
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			'disabled:pointer-events-none disabled:opacity-50',
			'[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'
		],
		variants: {
			variant: {
				default: [
					'bg-primary text-primary-foreground',
					'hover:bg-primary/90',
					'active:bg-primary/80'
				],
				destructive: [
					'bg-destructive text-destructive-foreground',
					'hover:bg-destructive/90',
					'active:bg-destructive/80'
				],
				outline: [
					'border border-input bg-background',
					'hover:bg-accent hover:text-accent-foreground',
					'active:bg-accent/80'
				],
				secondary: [
					'bg-secondary text-secondary-foreground',
					'hover:bg-secondary/80',
					'active:bg-secondary/70'
				],
				ghost: [
					'hover:bg-accent hover:text-accent-foreground',
					'active:bg-accent/80'
				],
				link: [
					'text-primary underline-offset-4',
					'hover:underline'
				]
			},
			size: {
				default: 'h-10 px-4 py-2',
<<<<<<< HEAD
				sm: 'h-9 rounded-md px-3',
				lg: 'h-11 rounded-md px-8',
				icon: 'h-10 w-10'
			},
			fullWidth: {
				true: 'w-full',
				false: ''
=======
				sm: 'h-9 px-3 rounded-md',
				lg: 'h-11 px-8 rounded-md',
				icon: 'h-10 w-10'
>>>>>>> polecat/toast-mk1qtx0c
			}
		},
		defaultVariants: {
			variant: 'default',
<<<<<<< HEAD
			size: 'default',
			fullWidth: false
=======
			size: 'default'
>>>>>>> polecat/toast-mk1qtx0c
		}
	});

	export type ButtonVariants = VariantProps<typeof buttonVariants>;

	export interface ButtonProps {
		variant?: ButtonVariants['variant'];
		size?: ButtonVariants['size'];
<<<<<<< HEAD
		fullWidth?: boolean;
		loading?: boolean;
=======
		loading?: boolean;
		class?: string;
		disabled?: boolean;
>>>>>>> polecat/toast-mk1qtx0c
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
<<<<<<< HEAD
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes, ButtonProps {
=======

	interface Props extends Omit<HTMLButtonAttributes, keyof ButtonProps>, ButtonProps {
>>>>>>> polecat/toast-mk1qtx0c
		children?: Snippet;
		iconLeft?: Snippet;
		iconRight?: Snippet;
	}

	let {
		variant = 'default',
		size = 'default',
<<<<<<< HEAD
		fullWidth = false,
=======
>>>>>>> polecat/toast-mk1qtx0c
		loading = false,
		disabled = false,
		type = 'button',
		class: className = '',
		children,
		iconLeft,
		iconRight,
		...restProps
	}: Props = $props();

	// Combine disabled and loading states
	const isDisabled = $derived(disabled || loading);

	// Check if this is an icon-only button
	const isIconOnly = $derived(size === 'icon');

	// Accessible loading label
	const ariaLabel = $derived(
		loading ? 'Loading...' : restProps['aria-label']
	);
</script>

<button
	type={type}
<<<<<<< HEAD
	class={cn(buttonVariants({ variant, size, fullWidth }), className)}
=======
	class={cn(buttonVariants({ variant, size }), className)}
>>>>>>> polecat/toast-mk1qtx0c
	disabled={isDisabled}
	aria-disabled={isDisabled}
	aria-label={ariaLabel}
	aria-busy={loading}
	{...restProps}
>
	{#if loading}
		<svg
			class="h-4 w-4 animate-spin"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
			/>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	{:else if iconLeft}
		<span class="shrink-0" aria-hidden="true">
			{@render iconLeft()}
		</span>
	{/if}

<<<<<<< HEAD
	{#if children && size !== 'icon'}
		<span class={loading ? 'opacity-0' : ''}>
			{@render children()}
		</span>
	{:else if children && size === 'icon'}
=======
	{#if children && !isIconOnly}
		<span class={loading ? 'opacity-0' : ''}>
			{@render children()}
		</span>
	{:else if children && isIconOnly}
>>>>>>> polecat/toast-mk1qtx0c
		<span class="sr-only">
			{@render children()}
		</span>
		{#if !loading}
			{@render children()}
		{/if}
	{/if}

<<<<<<< HEAD
	{#if iconRight && !loading && size !== 'icon'}
		<span class="flex-shrink-0" aria-hidden="true">
=======
	{#if iconRight && !loading && !isIconOnly}
		<span class="shrink-0" aria-hidden="true">
>>>>>>> polecat/toast-mk1qtx0c
			{@render iconRight()}
		</span>
	{/if}
</button>
