import { describe, it, expect, vi } from 'vitest';
import { ChangeNotifier } from './change-notifier';

// Subclass to expose protected notifyChanges() for testing
class TestNotifier extends ChangeNotifier {
	notify(): void {
		this.notifyChanges();
	}
}

describe('ChangeNotifier', () => {
	it('calls listener when notifyChanges is called', () => {
		const notifier = new TestNotifier();
		const listener = vi.fn();

		notifier.onChange(listener);
		notifier.notify();

		expect(listener).toHaveBeenCalledOnce();
	});

	it('calls multiple listeners', () => {
		const notifier = new TestNotifier();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		notifier.onChange(listener1);
		notifier.onChange(listener2);
		notifier.notify();

		expect(listener1).toHaveBeenCalledOnce();
		expect(listener2).toHaveBeenCalledOnce();
	});

	it('returns unsubscribe function from onChange', () => {
		const notifier = new TestNotifier();
		const listener = vi.fn();

		const unsubscribe = notifier.onChange(listener);
		unsubscribe();
		notifier.notify();

		expect(listener).not.toHaveBeenCalled();
	});

	it('only unsubscribes the specific listener', () => {
		const notifier = new TestNotifier();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		const unsub1 = notifier.onChange(listener1);
		notifier.onChange(listener2);
		unsub1();
		notifier.notify();

		expect(listener1).not.toHaveBeenCalled();
		expect(listener2).toHaveBeenCalledOnce();
	});

	it('calls listeners on each notification', () => {
		const notifier = new TestNotifier();
		const listener = vi.fn();

		notifier.onChange(listener);
		notifier.notify();
		notifier.notify();
		notifier.notify();

		expect(listener).toHaveBeenCalledTimes(3);
	});

	it('dispose clears all listeners', () => {
		const notifier = new TestNotifier();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		notifier.onChange(listener1);
		notifier.onChange(listener2);
		notifier.dispose();
		notifier.notify();

		expect(listener1).not.toHaveBeenCalled();
		expect(listener2).not.toHaveBeenCalled();
	});

	it('can add new listeners after dispose', () => {
		const notifier = new TestNotifier();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		notifier.onChange(listener1);
		notifier.dispose();

		notifier.onChange(listener2);
		notifier.notify();

		expect(listener1).not.toHaveBeenCalled();
		expect(listener2).toHaveBeenCalledOnce();
	});

	it('handles duplicate listener registration (Set deduplication)', () => {
		const notifier = new TestNotifier();
		const listener = vi.fn();

		notifier.onChange(listener);
		notifier.onChange(listener);
		notifier.notify();

		// Set deduplicates, so listener is only called once
		expect(listener).toHaveBeenCalledOnce();
	});
});
