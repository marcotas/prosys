import Sortable from 'sortablejs';
import type { Action } from 'svelte/action';

export interface SortableOptions {
	/** Current items — triggers Svelte action update when list changes. */
	items: Array<{ id: string }>;
	/** Called after a within-list reorder with the new ordered item IDs. */
	onReorder?: (itemIds: string[]) => void;
	/** Called after a cross-list move. Fires on the source list's action with the target's item IDs (including the moved item spliced in). */
	onMove?: (itemId: string, toGroupId: string, targetItemIds: string[]) => void;
	/** Cross-list drag group config (string name or SortableJS GroupOptions). */
	group?: string | Sortable.GroupOptions;
	/** CSS selector for the drag handle element (default: '.drag-handle'). */
	handle?: string;
	/** Animation duration in ms (default: 150). */
	animation?: number;
	/** Escape hatch for any additional SortableJS options. */
	sortableOptions?: Partial<Sortable.Options>;
}

const DATA_ID_ATTR = 'data-sort-id';

/** Read ordered item IDs from a container's Element children. */
function readIds(container: HTMLElement): string[] {
	return Array.from(container.children)
		.map((el) => (el as HTMLElement).getAttribute(DATA_ID_ATTR))
		.filter((id): id is string => id !== null);
}

/**
 * Svelte action that wraps SortableJS with a DOM-revert pattern.
 *
 * SortableJS mutates the DOM directly (moves elements), but Svelte owns the DOM
 * via its reactivity system. After every SortableJS operation we synchronously
 * revert the DOM change using the element's saved nextSibling reference (which
 * accounts for Svelte's marker nodes), so Svelte can re-render correctly.
 *
 * NOTE: forceFallback MUST be true. WKWebView (Tauri's macOS browser engine)
 * does not reliably support native HTML5 DnD. The fallback mode uses
 * mouse/touch events instead, which work across all environments. SortableJS
 * sets pointer-events:none on the ghost clone, so it doesn't interfere with
 * elementFromPoint() hit detection on modern browsers.
 */
export const sortable: Action<HTMLElement, SortableOptions> = (node, initialOptions) => {
	let currentOptions = initialOptions;

	// Saved before drag starts — includes Svelte's internal marker nodes.
	let savedNextSibling: Node | null = null;
	let savedParent: HTMLElement | null = null;

	const instance = Sortable.create(node, buildSortableConfig(currentOptions));

	return {
		update(newOptions: SortableOptions) {
			currentOptions = newOptions;

			// Update mutable SortableJS options without recreating the instance.
			if (newOptions.group !== undefined) {
				instance.option('group', newOptions.group);
			}
			if (newOptions.handle !== undefined) {
				instance.option('handle', newOptions.handle);
			}
		},

		destroy() {
			instance.destroy();
		}
	};

	function buildSortableConfig(options: SortableOptions): Sortable.Options {
		return {
			// WKWebView requires fallback mode — native HTML5 DnD is unreliable there.
			forceFallback: true,
			fallbackOnBody: true,
			fallbackClass: 'sortable-fallback',

			ghostClass: 'sortable-ghost',
			chosenClass: 'sortable-chosen',
			dragClass: 'sortable-drag',

			// Mobile-friendly touch settings
			delayOnTouchOnly: true,
			delay: 100,
			touchStartThreshold: 5,

			// Scroll behavior
			scroll: true,
			scrollSensitivity: 80,
			scrollSpeed: 10,

			// ID attribute on draggable children
			dataIdAttr: DATA_ID_ATTR,

			// Configurable options with defaults
			group: options.group,
			handle: options.handle ?? '.drag-handle',
			animation: options.animation ?? 150,

			// User escape hatch (applied before our callbacks so it cannot override them)
			...options.sortableOptions,

			// Save the element's exact DOM position before SortableJS moves it.
			onStart(evt) {
				savedNextSibling = evt.item.nextSibling;
				savedParent = evt.from as HTMLElement;
			},

			// Core callback — revert DOM, then notify via callbacks.
			onEnd(evt) {
				const { oldIndex, newIndex, from, to, item } = evt;

				if (oldIndex === undefined || newIndex === undefined) return;

				if (from === to) {
					handleWithinListReorder(item);
				} else {
					handleCrossListMove(item, to);
				}

				savedNextSibling = null;
				savedParent = null;
			}
		};
	}

	/**
	 * Revert the element to its saved DOM position.
	 * Uses the nextSibling reference captured in onStart, which correctly
	 * accounts for Svelte's internal marker/comment nodes between {#each} items.
	 */
	function revertToSavedPosition(item: HTMLElement) {
		if (!savedParent) return;

		// If the item is currently in a different container (cross-list), remove it first.
		if (item.parentNode && item.parentNode !== savedParent) {
			item.parentNode.removeChild(item);
		}

		// Insert before the saved nextSibling (or append if it was the last child).
		savedParent.insertBefore(item, savedNextSibling);
	}

	/**
	 * Within-list reorder: read new order from DOM, revert, then call onReorder.
	 */
	function handleWithinListReorder(item: HTMLElement) {
		// Read the new order from the DOM BEFORE reverting.
		// SortableJS has already moved the element to its new position.
		const newOrderIds = readIds(item.parentNode as HTMLElement);

		// Hide the item during DOM revert to prevent visible snap-back.
		// Svelte re-renders on microtask (before next animation frame),
		// placing the element at the correct position.
		item.style.visibility = 'hidden';

		// Revert to exact original position (including Svelte marker nodes).
		revertToSavedPosition(item);

		currentOptions.onReorder?.(newOrderIds);

		// Restore visibility after Svelte re-render.
		requestAnimationFrame(() => {
			item.style.visibility = '';
		});
	}

	/**
	 * Cross-list move: read target order, revert DOM, then call onMove.
	 */
	function handleCrossListMove(item: HTMLElement, target: HTMLElement) {
		const itemId = item.getAttribute(DATA_ID_ATTR);
		if (!itemId) return;

		// Read the target container's group identifier (e.g., dayIndex for tasks).
		const toGroupId = target.getAttribute('data-sort-group-id') ?? '';

		// Read the target list's current item IDs (including the moved item).
		// We read this BEFORE reverting so the moved item is in the target DOM.
		const targetItemIds = readIds(target);

		// Hide during revert to prevent visible snap-back.
		item.style.visibility = 'hidden';

		// Revert to exact original position in source (including Svelte marker nodes).
		revertToSavedPosition(item);

		// Notify the source list's action about the move.
		currentOptions.onMove?.(itemId, toGroupId, targetItemIds);

		requestAnimationFrame(() => {
			item.style.visibility = '';
		});
	}
};
