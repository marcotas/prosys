# Step 9: Svelte Adapter

> Bridge ChangeNotifier to Svelte's `writable` store. When a ChangeNotifier calls `notifyChanges()`, the writable re-triggers Svelte's reactivity. Cleanup unsubscribes from both the store and the notifier.

**Files:**
- Create: `src/lib/adapters/svelte.ts`
- Create: `src/lib/adapters/svelte.test.ts`

**Dependencies:** Step 2 (ChangeNotifier base class)

**Note:** This test uses a mock writable to avoid needing full Svelte test infrastructure.

---

## Step 1: Write the failing test

Create `src/lib/adapters/svelte.test.ts`:

```ts
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
		// Test helper
		_subscriberCount: () => subscribers.size
	};
}

// Inline the adapter logic for testing without Svelte imports
function useNotifierTestable<T extends ChangeNotifier>(
	notifier: T,
	writableFn: typeof mockWritable
) {
	const store = writableFn(notifier);
	const unsubscribe = notifier.onChange(() => store.set(notifier));

	return {
		subscribe(run: (value: T) => void) {
			const unsub = store.subscribe(run);
			return () => {
				unsub();
				unsubscribe();
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

		expect(values).toEqual([0]); // initial
		unsub();
	});

	it('triggers subscriber when notifier changes', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);

		const values: number[] = [];
		const unsub = store.subscribe((n) => values.push(n.value));

		notifier.increment();
		notifier.increment();

		expect(values).toEqual([0, 1, 2]); // initial + 2 updates
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

		expect(values).toEqual([0, 1]); // should not get the second increment
	});

	it('unsubscribe cleans up notifier listener', () => {
		const notifier = new TestNotifier();
		const store = useNotifierTestable(notifier, mockWritable);

		const listener = vi.fn();
		notifier.onChange(listener);

		const unsub = store.subscribe(() => {});
		unsub();

		// The adapter's internal listener should be removed,
		// but our test listener should still work
		notifier.increment();
		expect(listener).toHaveBeenCalledOnce();
	});
});
```

## Step 2: Run test to verify it fails

Run: `pnpm test src/lib/adapters/svelte.test.ts`

Expected: FAIL — `adapters/svelte.ts` does not exist.

**Note:** First, update `vite.config.ts` test include to also pick up adapter tests:

In `vite.config.ts`, change the test include pattern:

```ts
test: {
    include: ['src/lib/domain/**/*.test.ts', 'src/lib/adapters/**/*.test.ts'],
    alias: {
        '$lib': resolve(__dirname, 'src/lib')
    }
},
```

## Step 3: Write the implementation

Create `src/lib/adapters/svelte.ts`:

```ts
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
```

## Step 4: Run test to verify it passes

Run: `pnpm test src/lib/adapters/svelte.test.ts`

Expected: All tests PASS.

## Step 5: Run the full test suite

Run: `pnpm test`

Expected: ALL tests across all files PASS.

## Step 6: Commit

```bash
git add src/lib/adapters/svelte.ts src/lib/adapters/svelte.test.ts vite.config.ts
git commit -m "feat: add Svelte adapter (useNotifier) bridging ChangeNotifier to writable store"
```
