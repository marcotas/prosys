import { writable, type Writable } from 'svelte/store';
import type { ChangeNotifier } from '$lib/domain/change-notifier';

/**
 * Bridge a ChangeNotifier instance to a Svelte writable store.
 *
 * When the notifier calls `notifyChanges()`, the writable triggers
 * Svelte's reactivity by re-setting the same reference.
 *
 * The returned store cleans up the notifier listener when the last
 * Svelte subscriber unsubscribes.
 */
export function useNotifier<T extends ChangeNotifier>(notifier: T): Writable<T> {
	const store = writable(notifier);
	const unsubscribe = notifier.onChange(() => store.set(notifier));

	return {
		subscribe(run, invalidate) {
			const unsub = store.subscribe(run, invalidate);
			return () => {
				unsub();
				unsubscribe();
			};
		},
		set: store.set,
		update: store.update
	};
}
