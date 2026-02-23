/**
 * Shared swipe-to-reveal controller for touch-based list items.
 * Used by DayCard (tasks) and HabitTracker (habits).
 */

export interface SwipeOptions {
	/** Width of the revealed action zone in px (default: 64) */
	zoneWidth?: number;
	/** Minimum leftward swipe distance to commit the reveal (default: 40) */
	threshold?: number;
	/** Minimum movement in either axis before direction-lock decides (default: 8) */
	lockThreshold?: number;
}

interface SwipeGestureState {
	itemId: string;
	startX: number;
	startY: number;
	currentX: number;
	locked: boolean;
}

export interface SwipeController {
	readonly swipedOpenId: string | null;
	readonly swipeState: SwipeGestureState | null;
	getSwipeOffset(itemId: string): number;
	onTouchStart(e: TouchEvent, itemId: string, guard?: () => boolean): void;
	close(): void;
	destroy(): void;
}

export function createSwipeController(options: SwipeOptions = {}): SwipeController {
	const { zoneWidth = 64, threshold = 40, lockThreshold = 8 } = options;

	let swipedOpenId = $state<string | null>(null);
	let swipeState = $state<SwipeGestureState | null>(null);

	function onTouchMove(e: TouchEvent) {
		if (!swipeState) return;
		const touch = e.touches[0];
		const dy = touch.clientY - swipeState.startY;

		if (!swipeState.locked) {
			const absDy = Math.abs(dy);
			// Use raw finger displacement for direction-lock (not virtual offset)
			const rawDx = Math.abs(
				touch.clientX -
					swipeState.startX +
					(swipedOpenId === swipeState.itemId ? zoneWidth : 0)
			);
			if (rawDx > lockThreshold || absDy > lockThreshold) {
				if (absDy > rawDx) {
					// Vertical scroll wins — cancel swipe
					swipeState = null;
					removeListeners();
					return;
				} else {
					swipeState.locked = true;
					e.preventDefault();
				}
			}
		}

		if (swipeState?.locked) {
			e.preventDefault();
			swipeState.currentX = touch.clientX;
		}
	}

	function onTouchEnd() {
		if (!swipeState) {
			removeListeners();
			return;
		}
		if (swipeState.locked) {
			const delta = swipeState.currentX - swipeState.startX;
			if (delta < -threshold) {
				swipedOpenId = swipeState.itemId;
			} else {
				swipedOpenId = null;
			}
		}
		swipeState = null;
		removeListeners();
	}

	function addListeners() {
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('touchend', onTouchEnd);
		window.addEventListener('touchcancel', onTouchEnd);
	}

	function removeListeners() {
		window.removeEventListener('touchmove', onTouchMove);
		window.removeEventListener('touchend', onTouchEnd);
		window.removeEventListener('touchcancel', onTouchEnd);
	}

	return {
		get swipedOpenId() {
			return swipedOpenId;
		},
		get swipeState() {
			return swipeState;
		},

		getSwipeOffset(itemId: string): number {
			if (swipeState?.itemId === itemId && swipeState.locked) {
				const delta = swipeState.currentX - swipeState.startX;
				return Math.max(-zoneWidth, Math.min(0, delta));
			}
			if (swipedOpenId === itemId) return -zoneWidth;
			return 0;
		},

		onTouchStart(e: TouchEvent, itemId: string, guard?: () => boolean) {
			if ((e.target as HTMLElement).closest('.drag-handle')) return;
			if (guard && !guard()) return;

			if (swipedOpenId && swipedOpenId !== itemId) {
				swipedOpenId = null;
				return;
			}
			const touch = e.touches[0];
			const startOffset = swipedOpenId === itemId ? -zoneWidth : 0;
			swipeState = {
				itemId,
				startX: touch.clientX - startOffset,
				startY: touch.clientY,
				currentX: touch.clientX,
				locked: false
			};
			addListeners();
		},

		close() {
			swipedOpenId = null;
		},

		destroy() {
			removeListeners();
		}
	};
}
