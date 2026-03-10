import Sortable from 'sortablejs';
import type { Action } from 'svelte/action';

export interface SortableOptions {
	/** Current items in the list (used for revert logic and ID extraction). */
	items: Array<{ id: string }>;
	/** Called after a within-list reorder with the new ordered item IDs. */
	onReorder?: (itemIds: string[]) => void;
	/** Called when an item from another list lands in this list. */
	onMove?: (itemId: string, newIndex: number) => void;
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

/**
 * Svelte action that wraps SortableJS with a DOM-revert pattern.
 *
 * SortableJS mutates the DOM directly (moves elements), but Svelte owns the DOM
 * via its reactivity system. After every SortableJS operation we synchronously
 * revert the DOM change so Svelte can re-render based on the new state delivered
 * through the callbacks.
 */
export const sortable: Action<HTMLElement, SortableOptions> = (node, initialOptions) => {
	let currentOptions = initialOptions;

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
			// Consistent cross-platform behavior
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

			// User escape hatch (applied before our onEnd so it cannot override it)
			...options.sortableOptions,

			// Core callback — always ours
			onEnd(evt) {
				const { oldIndex, newIndex, from, to, item } = evt;

				if (oldIndex === undefined || newIndex === undefined) return;

				const isSameList = from === to;

				if (isSameList) {
					handleWithinListReorder(item, from, oldIndex, newIndex);
				} else {
					handleCrossListMove(item, from, to, oldIndex, newIndex);
				}
			}
		};
	}

	/**
	 * Within-list reorder: revert the DOM, then call onReorder with the new order.
	 */
	function handleWithinListReorder(
		item: HTMLElement,
		container: HTMLElement,
		oldIndex: number,
		newIndex: number
	) {
		if (oldIndex === newIndex) return;

		// Revert: move the DOM element back to its original position.
		// SortableJS already moved it to newIndex, so we need to undo that.
		const referenceNode = container.children[oldIndex];
		if (oldIndex < newIndex) {
			// Item was moved forward — put it back before the element now at oldIndex
			container.insertBefore(item, referenceNode);
		} else {
			// Item was moved backward — put it back after the element now at oldIndex
			container.insertBefore(item, referenceNode.nextSibling);
		}

		// Compute the new order by applying the same splice logic to the items array.
		const items = currentOptions.items;
		const reordered = [...items];
		const [moved] = reordered.splice(oldIndex, 1);
		reordered.splice(newIndex, 0, moved);

		currentOptions.onReorder?.(reordered.map((i) => i.id));
	}

	/**
	 * Cross-list move: revert the DOM (remove from target, re-insert into source),
	 * then call onMove on the receiving list.
	 */
	function handleCrossListMove(
		item: HTMLElement,
		source: HTMLElement,
		target: HTMLElement,
		oldIndex: number,
		newIndex: number
	) {
		const itemId = item.getAttribute(DATA_ID_ATTR);
		if (!itemId) return;

		// Revert: SortableJS moved the item from source to target.
		// Remove it from target and put it back in source at its original position.
		target.removeChild(item);

		const refNode = source.children[oldIndex];
		if (refNode) {
			source.insertBefore(item, refNode);
		} else {
			source.appendChild(item);
		}

		// Notify the receiving list's action about the move.
		currentOptions.onMove?.(itemId, newIndex);
	}
};
