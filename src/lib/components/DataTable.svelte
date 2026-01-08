<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	/**
	 * DataTable variant definitions using tailwind-variants (shadcn pattern)
	 *
	 * Desktop-focused data table with sorting, selection, and proper accessibility.
	 * Variants: default, striped, bordered
	 * Sizes: sm, default, lg
	 */
	export const dataTableVariants = tv({
		slots: {
			root: 'w-full overflow-auto rounded-lg border border-border',
			table: 'w-full border-collapse text-sm',
			thead: 'sticky top-0 z-10 bg-muted/50 backdrop-blur-sm',
			th: [
				'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
				'border-b border-border'
			],
			tbody: '',
			tr: 'border-b border-border/50 transition-colors',
			td: 'text-foreground'
		},
		variants: {
			variant: {
				default: {
					tr: 'hover:bg-muted/30'
				},
				striped: {
					tr: 'even:bg-muted/20 hover:bg-muted/40'
				},
				bordered: {
					td: 'border-x border-border/30',
					th: 'border-x border-border/30'
				}
			},
			size: {
				sm: {
					th: 'px-3 py-2',
					td: 'px-3 py-2'
				},
				default: {
					th: 'px-4 py-3',
					td: 'px-4 py-3'
				},
				lg: {
					th: 'px-6 py-4',
					td: 'px-6 py-4'
				}
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type DataTableVariants = VariantProps<typeof dataTableVariants>;

	export interface Column<T> {
		/** Property key or dot-notation path */
		key: keyof T | string;
		/** Display header text */
		header: string;
		/** Enable sorting on this column */
		sortable?: boolean;
		/** Text alignment */
		align?: 'left' | 'center' | 'right';
		/** Fixed width (CSS value) */
		width?: string;
	}

	export interface DataTableProps<T> {
		columns: Column<T>[];
		data: T[];
		/** Property to use as unique row key */
		keyField?: keyof T;
		/** Current sort column key */
		sortKey?: string;
		/** Current sort direction */
		sortDirection?: 'asc' | 'desc';
		/** Called when sort changes */
		onSort?: (key: string, direction: 'asc' | 'desc') => void;
		/** Enable row selection */
		selectable?: boolean;
		/** Currently selected row keys */
		selectedKeys?: Set<unknown>;
		/** Called when selection changes */
		onSelect?: (keys: Set<unknown>) => void;
		/** Show loading skeleton */
		loading?: boolean;
		/** Number of skeleton rows to show */
		loadingRows?: number;
		/** Message when data is empty */
		emptyMessage?: string;
		/** Variant style */
		variant?: DataTableVariants['variant'];
		/** Size */
		size?: DataTableVariants['size'];
		/** Additional CSS class */
		class?: string;
	}
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
	import { cn } from '$lib/utils';
	import { ArrowUp, ArrowDown, ArrowUpDown, Check, Minus } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import Skeleton from './Skeleton.svelte';

	interface Props extends DataTableProps<T> {
		/** Custom cell renderer - receives value, row, column key, and row index */
		cell?: Snippet<[{ value: unknown; row: T; key: string; index: number }]>;
	}

	let {
		columns,
		data,
		keyField,
		sortKey,
		sortDirection = 'asc',
		onSort,
		selectable = false,
		selectedKeys = new Set(),
		onSelect,
		loading = false,
		loadingRows = 5,
		emptyMessage = 'No data available',
		variant = 'default',
		size = 'default',
		class: className = '',
		cell
	}: Props = $props();

	const styles = $derived(dataTableVariants({ variant, size }));

	// Get value from row using key (supports dot notation)
	function getValue(row: T, key: string): unknown {
		if (key.includes('.')) {
			return key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], row as unknown);
		}
		return row[key as keyof T];
	}

	// Get unique key for a row
	function getRowKey(row: T, index: number): unknown {
		if (keyField) {
			return row[keyField];
		}
		return index;
	}

	// Handle sort click
	function handleSort(column: Column<T>) {
		if (!column.sortable || !onSort) return;

		const key = String(column.key);
		const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
		onSort(key, newDirection);
	}

	// Handle header keyboard navigation
	function handleHeaderKeydown(event: KeyboardEvent, column: Column<T>) {
		if (!column.sortable) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSort(column);
		}
	}

	// Check if all rows are selected
	const allSelected = $derived(
		data.length > 0 && data.every((row, i) => selectedKeys.has(getRowKey(row, i)))
	);

	// Check if some (but not all) rows are selected
	const someSelected = $derived(
		!allSelected && data.some((row, i) => selectedKeys.has(getRowKey(row, i)))
	);

	// Toggle all rows selection
	function toggleAll() {
		if (!onSelect) return;

		if (allSelected) {
			onSelect(new Set());
		} else {
			const allKeys = new Set(data.map((row, i) => getRowKey(row, i)));
			onSelect(allKeys);
		}
	}

	// Toggle single row selection
	function toggleRow(row: T, index: number) {
		if (!onSelect) return;

		const key = getRowKey(row, index);
		const newSet = new Set(selectedKeys);

		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}

		onSelect(newSet);
	}

	// Get alignment class
	function getAlignClass(align?: 'left' | 'center' | 'right'): string {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	// Get aria-sort value
	function getAriaSort(column: Column<T>): 'ascending' | 'descending' | 'none' | undefined {
		if (!column.sortable) return undefined;
		if (sortKey !== String(column.key)) return 'none';
		return sortDirection === 'asc' ? 'ascending' : 'descending';
	}
</script>

<div class={cn(styles.root(), className)} role="region" aria-label="Data table">
	<table class={styles.table()} aria-busy={loading}>
		<thead class={styles.thead()}>
			<tr>
				{#if selectable}
					<th class={cn(styles.th(), 'w-12')} scope="col">
						<button
							type="button"
							class="flex h-5 w-5 items-center justify-center rounded border border-border bg-background
								hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
								{allSelected ? 'bg-primary border-primary' : ''}"
							onclick={toggleAll}
							aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
						>
							{#if allSelected}
								<Check class="h-3 w-3 text-primary-foreground" />
							{:else if someSelected}
								<Minus class="h-3 w-3 text-muted-foreground" />
							{/if}
						</button>
					</th>
				{/if}

				{#each columns as column}
					<th
						class={cn(styles.th(), getAlignClass(column.align))}
						scope="col"
						style={column.width ? `width: ${column.width}` : undefined}
						aria-sort={getAriaSort(column)}
					>
						{#if column.sortable && onSort}
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-foreground transition-colors
									focus:outline-none focus:text-foreground"
								onclick={() => handleSort(column)}
								onkeydown={(e) => handleHeaderKeydown(e, column)}
							>
								{column.header}
								{#if sortKey === String(column.key)}
									{#if sortDirection === 'asc'}
										<ArrowUp class="h-3 w-3" />
									{:else}
										<ArrowDown class="h-3 w-3" />
									{/if}
								{:else}
									<ArrowUpDown class="h-3 w-3 opacity-50" />
								{/if}
							</button>
						{:else}
							{column.header}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody class={styles.tbody()}>
			{#if loading}
				{#each Array(loadingRows) as _, i}
					<tr class={styles.tr()}>
						{#if selectable}
							<td class={cn(styles.td(), 'w-12')}>
								<Skeleton class="h-5 w-5 rounded" />
							</td>
						{/if}
						{#each columns as column}
							<td class={cn(styles.td(), getAlignClass(column.align))}>
								<Skeleton class="h-4 w-3/4 rounded" />
							</td>
						{/each}
					</tr>
				{/each}
			{:else if data.length === 0}
				<tr>
					<td
						colspan={selectable ? columns.length + 1 : columns.length}
						class="px-4 py-12 text-center text-muted-foreground"
					>
						{emptyMessage}
					</td>
				</tr>
			{:else}
				{#each data as row, index}
					{@const rowKey = getRowKey(row, index)}
					{@const isSelected = selectedKeys.has(rowKey)}
					<tr
						class={cn(styles.tr(), isSelected && 'bg-primary/5')}
						aria-selected={selectable ? isSelected : undefined}
					>
						{#if selectable}
							<td class={cn(styles.td(), 'w-12')}>
								<button
									type="button"
									class="flex h-5 w-5 items-center justify-center rounded border border-border bg-background
										hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
										{isSelected ? 'bg-primary border-primary' : ''}"
									onclick={() => toggleRow(row, index)}
									aria-label={isSelected ? 'Deselect row' : 'Select row'}
								>
									{#if isSelected}
										<Check class="h-3 w-3 text-primary-foreground" />
									{/if}
								</button>
							</td>
						{/if}

						{#each columns as column}
							{@const value = getValue(row, String(column.key))}
							<td class={cn(styles.td(), getAlignClass(column.align))}>
								{#if cell}
									{@render cell({ value, row, key: String(column.key), index })}
								{:else}
									{value ?? '—'}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
