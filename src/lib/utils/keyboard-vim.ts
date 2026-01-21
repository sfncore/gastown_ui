/**
 * Vim-Style Keyboard Navigation
 *
 * Provides vim-style shortcuts for the application:
 * - Navigation sequences: g+d (dashboard), g+a (agents), etc.
 * - List navigation: j (down), k (up), Enter (open), Escape (deselect), x (toggle)
 * - Actions: r (refresh), c (create), s (sling), / (search), ? (help)
 * - Command palette: Cmd/Ctrl+K
 */

import { goto } from '$app/navigation';

export interface VimShortcut {
	key: string | string[]; // Single key or sequence (e.g., ['g', 'd'])
	description: string;
	action: () => void;
	category: 'navigation' | 'list' | 'action' | 'system';
	requiresListContext?: boolean; // Only active when a list is focused
}

export interface ListState {
	items: HTMLElement[];
	selectedIndex: number;
	containerId: string;
}

// Sequence timeout (ms) - how long to wait for the second key in a sequence
const SEQUENCE_TIMEOUT = 500;

export class VimKeyboardManager {
	private shortcuts: Map<string, VimShortcut> = new Map();
	private sequenceShortcuts: Map<string, Map<string, VimShortcut>> = new Map();
	private isInputFocused = false;
	private helpOpen = false;

	// Sequence tracking
	private pendingSequence: string | null = null;
	private sequenceTimer: ReturnType<typeof setTimeout> | null = null;

	// List navigation state
	private activeList: ListState | null = null;
	private listContainers: Map<string, HTMLElement> = new Map();

	// Event handlers bound to this instance
	private boundHandleKeyDown: (e: KeyboardEvent) => void;
	private boundUpdateInputFocus: (e: FocusEvent) => void;

	constructor() {
		this.boundHandleKeyDown = this.handleKeyDown.bind(this);
		this.boundUpdateInputFocus = this.updateInputFocus.bind(this);

		if (typeof window !== 'undefined') {
			document.addEventListener('keydown', this.boundHandleKeyDown);
			document.addEventListener('focus', this.boundUpdateInputFocus, true);
			document.addEventListener('blur', this.boundUpdateInputFocus, true);
		}
	}

	/**
	 * Register a vim shortcut
	 */
	register(id: string, shortcut: VimShortcut) {
		if (Array.isArray(shortcut.key)) {
			// Sequence shortcut (e.g., ['g', 'd'])
			const [prefix, suffix] = shortcut.key;
			if (!this.sequenceShortcuts.has(prefix)) {
				this.sequenceShortcuts.set(prefix, new Map());
			}
			this.sequenceShortcuts.get(prefix)!.set(suffix, shortcut);
		} else {
			// Single key shortcut
			this.shortcuts.set(shortcut.key, shortcut);
		}
	}

	/**
	 * Unregister a shortcut
	 */
	unregister(id: string) {
		this.shortcuts.delete(id);
		// Also check sequence shortcuts
		for (const [_, suffixMap] of this.sequenceShortcuts) {
			for (const [key, shortcut] of suffixMap) {
				if (id === key) {
					suffixMap.delete(key);
				}
			}
		}
	}

	/**
	 * Get all registered shortcuts for display
	 */
	getShortcuts(): VimShortcut[] {
		const all: VimShortcut[] = [];

		// Single key shortcuts
		for (const shortcut of this.shortcuts.values()) {
			all.push(shortcut);
		}

		// Sequence shortcuts
		for (const [prefix, suffixMap] of this.sequenceShortcuts) {
			for (const shortcut of suffixMap.values()) {
				all.push(shortcut);
			}
		}

		return all;
	}

	/**
	 * Get shortcuts by category
	 */
	getShortcutsByCategory(category: 'navigation' | 'list' | 'action' | 'system'): VimShortcut[] {
		return this.getShortcuts().filter((s) => s.category === category);
	}

	/**
	 * Format shortcut keys for display
	 */
	formatShortcut(key: string | string[]): string {
		if (Array.isArray(key)) {
			return key.join(' then ');
		}
		if (key === '/') return '/';
		if (key === '?') return '?';
		return key.toUpperCase();
	}

	/**
	 * Register a list container for j/k navigation
	 */
	registerList(containerId: string, element: HTMLElement) {
		this.listContainers.set(containerId, element);
	}

	/**
	 * Unregister a list container
	 */
	unregisterList(containerId: string) {
		this.listContainers.delete(containerId);
		if (this.activeList?.containerId === containerId) {
			this.activeList = null;
		}
	}

	/**
	 * Set the active list for keyboard navigation
	 */
	setActiveList(containerId: string) {
		const container = this.listContainers.get(containerId);
		if (!container) return;

		const items = Array.from(
			container.querySelectorAll('[data-list-item]')
		) as HTMLElement[];

		this.activeList = {
			items,
			selectedIndex: -1,
			containerId
		};
	}

	/**
	 * Clear active list
	 */
	clearActiveList() {
		if (this.activeList) {
			this.clearListSelection();
		}
		this.activeList = null;
	}

	/**
	 * Get current selected item
	 */
	getSelectedItem(): HTMLElement | null {
		if (!this.activeList || this.activeList.selectedIndex < 0) {
			return null;
		}
		return this.activeList.items[this.activeList.selectedIndex] || null;
	}

	/**
	 * Navigate list down (j key)
	 */
	private navigateDown() {
		if (!this.activeList) return;

		const { items, selectedIndex } = this.activeList;
		if (items.length === 0) return;

		// Clear previous selection
		this.clearListSelection();

		// Move to next item (or first if none selected)
		this.activeList.selectedIndex =
			selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, items.length - 1);

		this.highlightSelectedItem();
	}

	/**
	 * Navigate list up (k key)
	 */
	private navigateUp() {
		if (!this.activeList) return;

		const { items, selectedIndex } = this.activeList;
		if (items.length === 0) return;

		// Clear previous selection
		this.clearListSelection();

		// Move to previous item (or last if none selected)
		this.activeList.selectedIndex =
			selectedIndex < 0 ? items.length - 1 : Math.max(selectedIndex - 1, 0);

		this.highlightSelectedItem();
	}

	/**
	 * Clear visual selection from list items
	 */
	private clearListSelection() {
		if (!this.activeList) return;

		for (const item of this.activeList.items) {
			item.setAttribute('data-vim-selected', 'false');
			item.classList.remove('vim-selected');
		}
	}

	/**
	 * Highlight the currently selected item
	 */
	private highlightSelectedItem() {
		if (!this.activeList || this.activeList.selectedIndex < 0) return;

		const item = this.activeList.items[this.activeList.selectedIndex];
		if (item) {
			item.setAttribute('data-vim-selected', 'true');
			item.classList.add('vim-selected');
			item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

			// Dispatch custom event for components to react
			window.dispatchEvent(
				new CustomEvent('vim-list-select', {
					detail: { item, index: this.activeList.selectedIndex }
				})
			);
		}
	}

	/**
	 * Open selected item (Enter key)
	 */
	private openSelectedItem() {
		const item = this.getSelectedItem();
		if (!item) return;

		// Check for link or button
		const link = item.querySelector('a') || item.closest('a');
		const button = item.querySelector('button') || item.closest('button');

		if (link) {
			link.click();
		} else if (button) {
			button.click();
		} else {
			// Dispatch event for custom handling
			window.dispatchEvent(
				new CustomEvent('vim-list-open', {
					detail: { item, index: this.activeList?.selectedIndex }
				})
			);
		}
	}

	/**
	 * Toggle selection (x key)
	 */
	private toggleSelection() {
		const item = this.getSelectedItem();
		if (!item) return;

		const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
		if (checkbox) {
			checkbox.click();
		} else {
			// Dispatch event for custom handling
			const isSelected = item.getAttribute('data-vim-checked') === 'true';
			item.setAttribute('data-vim-checked', String(!isSelected));
			window.dispatchEvent(
				new CustomEvent('vim-list-toggle', {
					detail: { item, index: this.activeList?.selectedIndex, selected: !isSelected }
				})
			);
		}
	}

	/**
	 * Handle keydown events
	 */
	private handleKeyDown(event: KeyboardEvent) {
		// Skip if input is focused (except for Escape)
		if (this.isInputFocused) {
			if (event.key === 'Escape') {
				// Allow Escape to blur inputs
				(document.activeElement as HTMLElement)?.blur();
				event.preventDefault();
			}
			return;
		}

		// Skip if modifier keys are pressed (let existing shortcuts handle those)
		if (event.metaKey || event.ctrlKey || event.altKey) {
			// Exception: Cmd/Ctrl+K for command palette
			if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
				event.preventDefault();
				this.openCommandPalette();
				return;
			}
			return;
		}

		const key = event.key.toLowerCase();

		// Check for sequence continuation
		if (this.pendingSequence) {
			const suffixMap = this.sequenceShortcuts.get(this.pendingSequence);
			if (suffixMap?.has(key)) {
				event.preventDefault();
				this.clearSequence();
				suffixMap.get(key)!.action();
				return;
			}
			// Invalid sequence - clear and continue
			this.clearSequence();
		}

		// Check for sequence start
		if (this.sequenceShortcuts.has(key)) {
			event.preventDefault();
			this.startSequence(key);
			return;
		}

		// Check for single-key shortcuts
		const shortcut = this.shortcuts.get(key);
		if (shortcut) {
			// Skip list-context shortcuts if no list is active
			if (shortcut.requiresListContext && !this.activeList) {
				return;
			}
			event.preventDefault();
			shortcut.action();
		}
	}

	/**
	 * Start a key sequence
	 */
	private startSequence(prefix: string) {
		this.pendingSequence = prefix;

		// Show sequence indicator
		window.dispatchEvent(
			new CustomEvent('vim-sequence-start', { detail: { prefix } })
		);

		// Set timeout to clear sequence
		this.sequenceTimer = setTimeout(() => {
			this.clearSequence();
		}, SEQUENCE_TIMEOUT);
	}

	/**
	 * Clear pending sequence
	 */
	private clearSequence() {
		this.pendingSequence = null;
		if (this.sequenceTimer) {
			clearTimeout(this.sequenceTimer);
			this.sequenceTimer = null;
		}

		// Hide sequence indicator
		window.dispatchEvent(new CustomEvent('vim-sequence-end'));
	}

	/**
	 * Open command palette
	 */
	private openCommandPalette() {
		window.dispatchEvent(new CustomEvent('open-search'));
	}

	/**
	 * Open help dialog
	 */
	openHelp() {
		this.helpOpen = true;
		window.dispatchEvent(
			new CustomEvent('keyboard-help-toggle', { detail: { open: true } })
		);
	}

	/**
	 * Close help dialog
	 */
	closeHelp() {
		this.helpOpen = false;
		window.dispatchEvent(
			new CustomEvent('keyboard-help-toggle', { detail: { open: false } })
		);
	}

	/**
	 * Toggle help dialog
	 */
	toggleHelp() {
		if (this.helpOpen) {
			this.closeHelp();
		} else {
			this.openHelp();
		}
	}

	/**
	 * Update input focus state
	 */
	private updateInputFocus(event: FocusEvent) {
		const target = event.target as HTMLElement;
		this.isInputFocused =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			(target && target.contentEditable === 'true');
	}

	/**
	 * Destroy the manager and clean up
	 */
	destroy() {
		if (typeof window !== 'undefined') {
			document.removeEventListener('keydown', this.boundHandleKeyDown);
			document.removeEventListener('focus', this.boundUpdateInputFocus, true);
			document.removeEventListener('blur', this.boundUpdateInputFocus, true);
		}
		this.clearSequence();
		this.activeList = null;
		this.listContainers.clear();
	}
}

// Singleton instance
let vimManager: VimKeyboardManager | null = null;

/**
 * Initialize vim keyboard shortcuts
 */
export function initializeVimShortcuts(): VimKeyboardManager {
	if (typeof window !== 'undefined' && !vimManager) {
		vimManager = new VimKeyboardManager();

		// Register navigation shortcuts (g + key sequences)
		vimManager.register('nav-dashboard', {
			key: ['g', 'd'],
			description: 'Go to Dashboard',
			action: () => goto('/'),
			category: 'navigation'
		});

		vimManager.register('nav-agents', {
			key: ['g', 'a'],
			description: 'Go to Agents',
			action: () => goto('/agents'),
			category: 'navigation'
		});

		vimManager.register('nav-rigs', {
			key: ['g', 'r'],
			description: 'Go to Rigs',
			action: () => goto('/rigs'),
			category: 'navigation'
		});

		vimManager.register('nav-work', {
			key: ['g', 'w'],
			description: 'Go to Work',
			action: () => goto('/work'),
			category: 'navigation'
		});

		vimManager.register('nav-mail', {
			key: ['g', 'm'],
			description: 'Go to Mail',
			action: () => goto('/mail'),
			category: 'navigation'
		});

		vimManager.register('nav-queue', {
			key: ['g', 'q'],
			description: 'Go to Queue',
			action: () => goto('/queue'),
			category: 'navigation'
		});

		vimManager.register('nav-convoys', {
			key: ['g', 'c'],
			description: 'Go to Convoys',
			action: () => goto('/convoys'),
			category: 'navigation'
		});

		// List navigation shortcuts
		vimManager.register('list-down', {
			key: 'j',
			description: 'Next item',
			action: () => vimManager!['navigateDown'](),
			category: 'list',
			requiresListContext: true
		});

		vimManager.register('list-up', {
			key: 'k',
			description: 'Previous item',
			action: () => vimManager!['navigateUp'](),
			category: 'list',
			requiresListContext: true
		});

		vimManager.register('list-open', {
			key: 'enter',
			description: 'Open selected',
			action: () => vimManager!['openSelectedItem'](),
			category: 'list',
			requiresListContext: true
		});

		vimManager.register('list-deselect', {
			key: 'escape',
			description: 'Deselect/close',
			action: () => vimManager!.clearActiveList(),
			category: 'list'
		});

		vimManager.register('list-toggle', {
			key: 'x',
			description: 'Toggle select',
			action: () => vimManager!['toggleSelection'](),
			category: 'list',
			requiresListContext: true
		});

		// Action shortcuts
		vimManager.register('action-refresh', {
			key: 'r',
			description: 'Refresh',
			action: () => window.dispatchEvent(new CustomEvent('vim-refresh')),
			category: 'action'
		});

		vimManager.register('action-create', {
			key: 'c',
			description: 'Create new',
			action: () => window.dispatchEvent(new CustomEvent('vim-create')),
			category: 'action'
		});

		vimManager.register('action-sling', {
			key: 's',
			description: 'Sling (assign work)',
			action: () => window.dispatchEvent(new CustomEvent('vim-sling')),
			category: 'action'
		});

		vimManager.register('action-search', {
			key: '/',
			description: 'Focus search',
			action: () => window.dispatchEvent(new CustomEvent('open-search')),
			category: 'action'
		});

		vimManager.register('action-help', {
			key: '?',
			description: 'Show help',
			action: () => vimManager!.toggleHelp(),
			category: 'system'
		});
	}

	return vimManager!;
}

/**
 * Get the vim keyboard manager instance
 */
export function getVimManager(): VimKeyboardManager | null {
	return vimManager;
}

/**
 * Svelte action for registering a list container
 */
export function vimList(node: HTMLElement, containerId: string) {
	const manager = getVimManager();
	if (manager) {
		manager.registerList(containerId, node);

		// Set as active when focused or clicked
		const handleFocus = () => manager.setActiveList(containerId);
		const handleClick = () => manager.setActiveList(containerId);

		node.addEventListener('focusin', handleFocus);
		node.addEventListener('click', handleClick);

		return {
			destroy() {
				manager.unregisterList(containerId);
				node.removeEventListener('focusin', handleFocus);
				node.removeEventListener('click', handleClick);
			}
		};
	}
}
