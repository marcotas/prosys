import { describe, it, expect } from 'vitest';
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
		const { memberId, ...input } = validInput;
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
