import { describe, it, expect, vi } from 'vitest';
import { ChangeNotifier } from '$lib/domain/change-notifier';

// Test subclass that exposes notifyChanges
class TestNotifier extends ChangeNotifier {
	value = 0;

	increment(): void {
		this.value++;
		this.notifyChanges();
	}
}

// Mock writable to avoid Svelte dependency in unit tests
function mockWritable<T>(initial: T) {
	let current = initial;
	const subscribers = new Set<(value: T) => void>();

	return {
		set(value: T) {
			current = value;
			for (const sub of subscribers) sub(current);
		},
		subscribe(run: (value: T) => void) {
			subscribers.add(run);
			run(current);
			return () => {
				subscribers.delete(run);
			};
		},
		update(fn: (value: T) => T) {
			this.set(fn(current));
		},
		_subscriberCount: () => subscribers.size
	};
}

// Inline the adapter logic for testing without Svelte imports
function useNotifierTestable<T extends ChangeNotifier>(
	notifier: T,
	writableFn: typeof mockWritable
) {
	const store = writableFn(notifier);
	let subscriberCount = 0;
	let unsubscribeNotifier: (() => void) | null = null;

	return {
		subscribe(run: (value: T) => void) {
			if (subscriberCount === 0) {
				unsubscribeNotifier = notifier.onChange(() => store.set(notifier));
			}
			subscriberCount++;
			const unsub = store.subscribe(run);
			return () => {
				unsub();
				subscriberCount--;
				if (subscriberCount === 0 && unsubscribeNotifier) {
					unsubscribeNotifier();
					unsubscribeNotifier = null;
				}
			};
		},
		set: store.set,
		update: store.update
	};
}

describe('useNotifier adapter', () => {
	it('calls subscriber with initial value', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);
		const values: number[] = [];
		const unsub = store.subscribe((n) => values.push(n.value));
		expect(values).toEqual([0]);
		unsub();
	});

	it('triggers subscriber when notifier changes', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);
		const values: number[] = [];
		const unsub = store.subscribe((n) => values.push(n.value));
		notifier.increment();
		notifier.increment();
		expect(values).toEqual([0, 1, 2]);
		unsub();
	});

	it('unsubscribe stops receiving updates', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);
		const values: number[] = [];
		const unsub = store.subscribe((n) => values.push(n.value));
		notifier.increment();
		unsub();
		notifier.increment();
		expect(values).toEqual([0, 1]);
	});

	it('unsubscribe cleans up notifier listener', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);
		const listener = vi.fn();
		notifier.onChange(listener);
		const unsub = store.subscribe(() => {});
		unsub();
		notifier.increment();
		expect(listener).toHaveBeenCalledOnce();
	});

	it('multi-subscriber: first unsub does not break second subscriber', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);

		const values1: number[] = [];
		const values2: number[] = [];
		const unsub1 = store.subscribe((n) => values1.push(n.value));
		const unsub2 = store.subscribe((n) => values2.push(n.value));

		notifier.increment(); // both should receive
		unsub1(); // first unsubscribes
		notifier.increment(); // second should still receive

		expect(values1).toEqual([0, 1]); // initial + 1 update
		expect(values2).toEqual([0, 1, 2]); // initial + 2 updates

		unsub2();
	});

	it('re-subscribing after all unsub reconnects notifier', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);

		const unsub1 = store.subscribe(() => {});
		unsub1(); // all unsubscribed, notifier listener removed

		const values: number[] = [];
		notifier.increment(); // should NOT be captured

		const unsub2 = store.subscribe((n) => values.push(n.value));
		notifier.increment(); // should be captured

		expect(values).toEqual([1, 2]); // initial (value=1) + update (value=2)
		unsub2();
	});
});
