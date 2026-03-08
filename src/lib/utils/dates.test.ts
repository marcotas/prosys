import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTaskPast } from './dates';

describe('isTaskPast', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns true for a day before today', () => {
		// Freeze to 2026-03-07 (Saturday)
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });

		// 2026-03-01 (Sunday) + dayIndex 0 = Sunday March 1 → past
		expect(isTaskPast('2026-03-01', 0)).toBe(true);
	});

	it('returns true for yesterday', () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });

		// 2026-03-01 (Sunday) + dayIndex 5 = Friday March 6 → past
		expect(isTaskPast('2026-03-01', 5)).toBe(true);
	});

	it('returns false for today', () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });

		// 2026-03-01 (Sunday) + dayIndex 6 = Saturday March 7 → today, not past
		expect(isTaskPast('2026-03-01', 6)).toBe(false);
	});

	it('returns false for a future day', () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });

		// 2026-03-08 (Sunday) + dayIndex 0 = Sunday March 8 → future
		expect(isTaskPast('2026-03-08', 0)).toBe(false);
	});

	it('returns false for today even at 11:59 PM', () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 23, 59, 59) });

		// dayIndex 6 = Saturday March 7 → still today
		expect(isTaskPast('2026-03-01', 6)).toBe(false);
	});

	it('returns true for yesterday even at midnight', () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 0, 0, 0) });

		// dayIndex 5 = Friday March 6 → yesterday
		expect(isTaskPast('2026-03-01', 5)).toBe(true);
	});
});
