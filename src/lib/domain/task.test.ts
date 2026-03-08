import { describe, it, expect } from 'vitest';
import { ValidationError, ConflictError } from './errors';
import { Task } from './task';
import type { TaskData } from './types';

// ── Helpers ──────────────────────────────────────────────

const validInput = {
	title: 'Buy milk',
	weekStart: '2026-03-01', // Sunday
	dayIndex: 1 as number,
	memberId: 'member-1',
	emoji: '🥛'
};

function makeTaskData(overrides: Partial<TaskData> = {}): TaskData {
	return {
		id: 'task-1',
		memberId: 'member-1',
		weekStart: '2026-03-01',
		dayIndex: 0,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		status: 'active',
		cancelledAt: null,
		rescheduleCount: 0,
		rescheduleHistory: null,
		rescheduledFromId: null,
		...overrides
	};
}

// ── create() ─────────────────────────────────────────────

describe('Task.create', () => {
	it('creates a task with valid input', () => {
		const task = Task.create(validInput);

		expect(task.id).toBeTruthy();
		expect(task.title).toBe('Buy milk');
		expect(task.weekStart).toBe('2026-03-01');
		expect(task.dayIndex).toBe(1);
		expect(task.memberId).toBe('member-1');
		expect(task.emoji).toBe('🥛');
		expect(task.isCompleted).toBe(false);
		expect(task.completed).toBe(false);
		expect(task.sortOrder).toBe(0);
	});

	it('defaults status to active and cancelledAt to null', () => {
		const task = Task.create(validInput);
		expect(task.status).toBe('active');
		expect(task.cancelledAt).toBeNull();
	});

	it('generates a unique id', () => {
		const task1 = Task.create(validInput);
		const task2 = Task.create(validInput);
		expect(task1.id).not.toBe(task2.id);
	});

	it('trims whitespace from title', () => {
		const task = Task.create({ ...validInput, title: '  Buy milk  ' });
		expect(task.title).toBe('Buy milk');
	});

	it('defaults memberId to null when not provided', () => {
		const { memberId: _memberId, ...input } = validInput;
		const task = Task.create(input);
		expect(task.memberId).toBeNull();
	});

	it('throws on empty title', () => {
		expect(() => Task.create({ ...validInput, title: '' })).toThrow('Title is required');
	});

	it('throws on whitespace-only title', () => {
		expect(() => Task.create({ ...validInput, title: '   ' })).toThrow('Title is required');
	});

	it('throws on dayIndex below 0', () => {
		expect(() => Task.create({ ...validInput, dayIndex: -1 })).toThrow('Day index must be 0-6');
	});

	it('throws on dayIndex above 6', () => {
		expect(() => Task.create({ ...validInput, dayIndex: 7 })).toThrow('Day index must be 0-6');
	});

	it('accepts boundary dayIndex 0', () => {
		expect(() => Task.create({ ...validInput, dayIndex: 0 })).not.toThrow();
	});

	it('accepts boundary dayIndex 6', () => {
		expect(() => Task.create({ ...validInput, dayIndex: 6 })).not.toThrow();
	});

	it('throws on empty weekStart', () => {
		expect(() => Task.create({ ...validInput, weekStart: '' })).toThrow('Week start is required');
	});

	it('throws on non-Sunday weekStart', () => {
		expect(() => Task.create({ ...validInput, weekStart: '2026-03-02' })).toThrow(
			'Week must start on Sunday'
		);
	});

	it('throws on malformed weekStart', () => {
		expect(() => Task.create({ ...validInput, weekStart: 'not-a-date' })).toThrow();
	});

	it('collects multiple validation errors', () => {
		expect(() =>
			Task.create({ title: '', weekStart: '2026-03-02', dayIndex: 7 })
		).toThrow(/Title is required.*Day index must be 0-6/);
	});
});

// ── fromData() ───────────────────────────────────────────

describe('Task.fromData', () => {
	it('hydrates all fields from data', () => {
		const data = makeTaskData({ emoji: '🎯' });
		const task = Task.fromData(data);

		expect(task.id).toBe('task-1');
		expect(task.title).toBe('Test task');
		expect(task.memberId).toBe('member-1');
		expect(task.weekStart).toBe('2026-03-01');
		expect(task.dayIndex).toBe(0);
		expect(task.emoji).toBe('🎯');
		expect(task.isCompleted).toBe(false);
		expect(task.sortOrder).toBe(0);
	});

	it('does not validate (trusted hydration)', () => {
		const data = makeTaskData({ dayIndex: 99 });
		const task = Task.fromData(data);
		expect(task.dayIndex).toBe(99);
	});

	it('creates an independent copy (no shared references)', () => {
		const data = makeTaskData();
		const task = Task.fromData(data);
		data.title = 'Changed externally';
		expect(task.title).toBe('Test task');
	});

	it('defaults status to active when undefined (backward compat)', () => {
		const data = makeTaskData();
		// Simulate legacy data without status/cancelledAt
		const legacy = { ...data } as Record<string, unknown>;
		delete legacy.status;
		delete legacy.cancelledAt;
		const task = Task.fromData(legacy as TaskData);
		expect(task.status).toBe('active');
		expect(task.cancelledAt).toBeNull();
	});
});

// ── Mutations ────────────────────────────────────────────

describe('Task mutations', () => {
	it('complete() sets isCompleted to true', () => {
		const task = Task.fromData(makeTaskData({ completed: false }));
		task.complete();
		expect(task.isCompleted).toBe(true);
	});

	it('uncomplete() sets isCompleted to false', () => {
		const task = Task.fromData(makeTaskData({ completed: true }));
		task.uncomplete();
		expect(task.isCompleted).toBe(false);
	});

	it('toggleCompletion() flips the state', () => {
		const task = Task.fromData(makeTaskData({ completed: false }));
		task.toggleCompletion();
		expect(task.isCompleted).toBe(true);
		task.toggleCompletion();
		expect(task.isCompleted).toBe(false);
	});

	it('updateTitle() updates the title', () => {
		const task = Task.fromData(makeTaskData());
		task.updateTitle('New title');
		expect(task.title).toBe('New title');
	});

	it('updateTitle() trims whitespace', () => {
		const task = Task.fromData(makeTaskData());
		task.updateTitle('  Trimmed  ');
		expect(task.title).toBe('Trimmed');
	});

	it('updateTitle() throws on empty string', () => {
		const task = Task.fromData(makeTaskData());
		expect(() => task.updateTitle('')).toThrow('Title cannot be empty');
	});

	it('updateTitle() throws on whitespace-only', () => {
		const task = Task.fromData(makeTaskData());
		expect(() => task.updateTitle('   ')).toThrow('Title cannot be empty');
	});

	it('updateEmoji() updates the emoji', () => {
		const task = Task.fromData(makeTaskData());
		task.updateEmoji('🎯');
		expect(task.emoji).toBe('🎯');
	});

	it('updateEmoji(undefined) clears the emoji', () => {
		const task = Task.fromData(makeTaskData({ emoji: '🎯' }));
		task.updateEmoji(undefined);
		expect(task.emoji).toBeUndefined();
	});

	it('setSortOrder() updates sort order', () => {
		const task = Task.fromData(makeTaskData());
		task.setSortOrder(5);
		expect(task.sortOrder).toBe(5);
	});

	it('setDay() updates dayIndex, weekStart, and sortOrder', () => {
		const task = Task.fromData(makeTaskData({ dayIndex: 0, weekStart: '2026-03-01' }));
		task.setDay(3, '2026-03-08', 2);
		expect(task.dayIndex).toBe(3);
		expect(task.weekStart).toBe('2026-03-08');
		expect(task.sortOrder).toBe(2);
	});

	it('setDay() throws on invalid dayIndex', () => {
		const task = Task.fromData(makeTaskData());
		expect(() => task.setDay(-1, '2026-03-01', 0)).toThrow('Day index must be 0-6');
		expect(() => task.setDay(7, '2026-03-01', 0)).toThrow('Day index must be 0-6');
	});

	it('assignTo() updates memberId', () => {
		const task = Task.fromData(makeTaskData({ memberId: 'member-1' }));
		task.assignTo('member-2');
		expect(task.memberId).toBe('member-2');
	});

	it('assignTo(null) clears memberId', () => {
		const task = Task.fromData(makeTaskData({ memberId: 'member-1' }));
		task.assignTo(null);
		expect(task.memberId).toBeNull();
	});

	it('cancel(today) sets status to cancelled and sets cancelledAt for past task', () => {
		// weekStart 2026-03-01 dayIndex 0 = Mar 1 (past relative to Mar 7)
		const task = Task.fromData(makeTaskData());
		const today = new Date(2026, 2, 7);
		expect(task.isCancelled).toBe(false);

		task.cancel(today);

		expect(task.status).toBe('cancelled');
		expect(task.isCancelled).toBe(true);
		expect(task.cancelledAt).toBeTruthy();
	});

	it('cancel(today) throws ValidationError when task is not past', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-08', dayIndex: 0 }));
		const today = new Date(2026, 2, 7);
		expect(() => task.cancel(today)).toThrow(ValidationError);
		expect(() => task.cancel(today)).toThrow('Only past tasks can be cancelled');
	});

	it('cancel(today) throws ConflictError when already cancelled', () => {
		const task = Task.fromData(
			makeTaskData({ status: 'cancelled', cancelledAt: '2026-03-01T00:00:00.000Z' })
		);
		const today = new Date(2026, 2, 7);
		expect(() => task.cancel(today)).toThrow(ConflictError);
		expect(() => task.cancel(today)).toThrow('Task is already cancelled');
	});

	it('isCancelled returns true for cancelled task', () => {
		const task = Task.fromData(
			makeTaskData({ status: 'cancelled', cancelledAt: '2026-03-01T00:00:00.000Z' })
		);
		expect(task.isCancelled).toBe(true);
	});

	it('isCancelled returns false for active task', () => {
		const task = Task.fromData(makeTaskData({ status: 'active' }));
		expect(task.isCancelled).toBe(false);
	});
});

// ── isPast ───────────────────────────────────────────────

describe('Task.isPast', () => {
	const today = new Date(2026, 2, 7, 12, 0, 0); // Mar 7

	it('returns true for a day before today', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 0 }));
		expect(task.isPast(today)).toBe(true);
	});

	it('returns true for yesterday', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 5 }));
		expect(task.isPast(today)).toBe(true);
	});

	it('returns false for today', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 6 }));
		expect(task.isPast(today)).toBe(false);
	});

	it('returns false for a future day', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-08', dayIndex: 0 }));
		expect(task.isPast(today)).toBe(false);
	});

	it('returns false for today at end of day', () => {
		const endOfDay = new Date(2026, 2, 7, 23, 59, 59);
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 6 }));
		expect(task.isPast(endOfDay)).toBe(false);
	});

	it('returns true for yesterday at midnight', () => {
		const midnight = new Date(2026, 2, 7, 0, 0, 0);
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 5 }));
		expect(task.isPast(midnight)).toBe(true);
	});
});

// ── isMove() ─────────────────────────────────────────────

describe('Task.isMove', () => {
	it('returns false when no day or week changes', () => {
		const task = Task.fromData(makeTaskData({ dayIndex: 0, weekStart: '2026-03-01' }));
		expect(task.isMove({})).toBe(false);
	});

	it('returns false when same dayIndex provided', () => {
		const task = Task.fromData(makeTaskData({ dayIndex: 0 }));
		expect(task.isMove({ dayIndex: 0 })).toBe(false);
	});

	it('returns false when same weekStart provided', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01' }));
		expect(task.isMove({ weekStart: '2026-03-01' })).toBe(false);
	});

	it('returns true when dayIndex changes', () => {
		const task = Task.fromData(makeTaskData({ dayIndex: 0 }));
		expect(task.isMove({ dayIndex: 3 })).toBe(true);
	});

	it('returns true when weekStart changes', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01' }));
		expect(task.isMove({ weekStart: '2026-03-08' })).toBe(true);
	});

	it('returns true when both change', () => {
		const task = Task.fromData(makeTaskData({ dayIndex: 0, weekStart: '2026-03-01' }));
		expect(task.isMove({ dayIndex: 3, weekStart: '2026-03-08' })).toBe(true);
	});
});

// ── reschedule() ────────────────────────────────────────

describe('Task.reschedule', () => {
	const today = new Date(2026, 2, 7); // Mar 7

	it('sets status to rescheduled for a past active task', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 0 }));
		task.reschedule(today);
		expect(task.status).toBe('rescheduled');
		expect(task.isRescheduled).toBe(true);
	});

	it('throws ValidationError if task is not past', () => {
		const task = Task.fromData(makeTaskData({ weekStart: '2026-03-08', dayIndex: 0 }));
		expect(() => task.reschedule(today)).toThrow(ValidationError);
		expect(() => task.reschedule(today)).toThrow('Only past tasks can be rescheduled');
	});

	it('throws ConflictError if task is cancelled', () => {
		const task = Task.fromData(
			makeTaskData({ weekStart: '2026-03-01', dayIndex: 0, status: 'cancelled' })
		);
		expect(() => task.reschedule(today)).toThrow(ConflictError);
		expect(() => task.reschedule(today)).toThrow('Only active tasks can be rescheduled');
	});

	it('throws ConflictError if task is already rescheduled', () => {
		const task = Task.fromData(
			makeTaskData({ weekStart: '2026-03-01', dayIndex: 0, status: 'rescheduled' })
		);
		expect(() => task.reschedule(today)).toThrow(ConflictError);
		expect(() => task.reschedule(today)).toThrow('Only active tasks can be rescheduled');
	});
});

// ── setRescheduleInfo() ─────────────────────────────────

describe('Task.setRescheduleInfo', () => {
	it('sets reschedule count, history, and fromId', () => {
		const task = Task.create({ title: 'Test', weekStart: '2026-03-01', dayIndex: 0 });
		const history = [{ date: '2026-03-01', count: 1 }];
		task.setRescheduleInfo(1, history, 'original-task-id');

		expect(task.rescheduleCount).toBe(1);
		expect(task.rescheduleHistory).toEqual(history);
		expect(task.rescheduledFromId).toBe('original-task-id');
	});

	it('serializes reschedule info in toJSON()', () => {
		const task = Task.create({ title: 'Test', weekStart: '2026-03-01', dayIndex: 0 });
		const history = [{ date: '2026-03-01', count: 1 }];
		task.setRescheduleInfo(1, history, 'original-task-id');

		const json = task.toJSON();
		expect(json.rescheduleCount).toBe(1);
		expect(json.rescheduleHistory).toEqual(history);
		expect(json.rescheduledFromId).toBe('original-task-id');
	});

	it('preserves reschedule info through clone()', () => {
		const task = Task.create({ title: 'Test', weekStart: '2026-03-01', dayIndex: 0 });
		task.setRescheduleInfo(2, [{ date: '2026-03-01', count: 1 }, { date: '2026-03-05', count: 2 }], 'prev-id');

		const cloned = task.clone();
		expect(cloned.rescheduleCount).toBe(2);
		expect(cloned.rescheduleHistory).toHaveLength(2);
		expect(cloned.rescheduledFromId).toBe('prev-id');
	});
});

// ── isRescheduled ───────────────────────────────────────

describe('Task.isRescheduled', () => {
	it('returns true for rescheduled task', () => {
		const task = Task.fromData(makeTaskData({ status: 'rescheduled' }));
		expect(task.isRescheduled).toBe(true);
	});

	it('returns false for active task', () => {
		const task = Task.fromData(makeTaskData({ status: 'active' }));
		expect(task.isRescheduled).toBe(false);
	});
});

// ── Serialization ────────────────────────────────────────

describe('Task serialization', () => {
	it('toJSON() returns plain data matching the input', () => {
		const data = makeTaskData({ emoji: '🎯' });
		const task = Task.fromData(data);
		expect(task.toJSON()).toEqual(data);
	});

	it('toJSON() returns an independent copy', () => {
		const task = Task.fromData(makeTaskData());
		const json = task.toJSON();
		json.title = 'Modified';
		expect(task.title).toBe('Test task');
	});

	it('clone() returns an independent copy', () => {
		const task = Task.fromData(makeTaskData());
		const cloned = task.clone();

		expect(cloned.toJSON()).toEqual(task.toJSON());

		cloned.updateTitle('Different');
		expect(task.title).toBe('Test task');
		expect(cloned.title).toBe('Different');
	});
});
