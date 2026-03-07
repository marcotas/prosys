import { describe, it, expect } from 'vitest';
import { Habit } from './habit';
import type { HabitData } from './types';

const validInput = {
	memberId: 'member-1',
	name: 'Read 30 minutes',
	emoji: '📚'
};

function makeHabitData(overrides: Partial<HabitData> = {}): HabitData {
	return {
		id: 'habit-1',
		memberId: 'member-1',
		name: 'Read 30 minutes',
		emoji: '📚',
		sortOrder: 0,
		...overrides
	};
}

describe('Habit.create', () => {
	it('creates a habit with valid input', () => {
		const habit = Habit.create(validInput);
		expect(habit.id).toBeTruthy();
		expect(habit.memberId).toBe('member-1');
		expect(habit.name).toBe('Read 30 minutes');
		expect(habit.emoji).toBe('📚');
		expect(habit.sortOrder).toBe(0);
	});

	it('generates a unique id', () => {
		const h1 = Habit.create(validInput);
		const h2 = Habit.create(validInput);
		expect(h1.id).not.toBe(h2.id);
	});

	it('trims whitespace from name', () => {
		const habit = Habit.create({ ...validInput, name: '  Read 30 minutes  ' });
		expect(habit.name).toBe('Read 30 minutes');
	});

	it('creates without emoji', () => {
		const { emoji: _emoji, ...input } = validInput;
		const habit = Habit.create(input);
		expect(habit.emoji).toBeUndefined();
	});

	it('throws on empty name', () => {
		expect(() => Habit.create({ ...validInput, name: '' })).toThrow('Name is required');
	});

	it('throws on whitespace-only name', () => {
		expect(() => Habit.create({ ...validInput, name: '   ' })).toThrow('Name is required');
	});

	it('throws on empty memberId', () => {
		expect(() => Habit.create({ ...validInput, memberId: '' })).toThrow('Member ID is required');
	});

	it('collects multiple validation errors', () => {
		expect(() => Habit.create({ memberId: '', name: '' })).toThrow(/Name is required.*Member ID is required/);
	});
});

describe('Habit.fromData', () => {
	it('hydrates all fields from data', () => {
		const data = makeHabitData();
		const habit = Habit.fromData(data);
		expect(habit.id).toBe('habit-1');
		expect(habit.memberId).toBe('member-1');
		expect(habit.name).toBe('Read 30 minutes');
		expect(habit.emoji).toBe('📚');
		expect(habit.sortOrder).toBe(0);
	});

	it('does not validate (trusted hydration)', () => {
		const data = makeHabitData({ name: '' });
		const habit = Habit.fromData(data);
		expect(habit.name).toBe('');
	});

	it('creates an independent copy', () => {
		const data = makeHabitData();
		const habit = Habit.fromData(data);
		data.name = 'Changed externally';
		expect(habit.name).toBe('Read 30 minutes');
	});
});

describe('Habit mutations', () => {
	it('updateName() updates the name', () => {
		const habit = Habit.fromData(makeHabitData());
		habit.updateName('Exercise');
		expect(habit.name).toBe('Exercise');
	});

	it('updateName() trims whitespace', () => {
		const habit = Habit.fromData(makeHabitData());
		habit.updateName('  Exercise  ');
		expect(habit.name).toBe('Exercise');
	});

	it('updateName() throws on empty string', () => {
		const habit = Habit.fromData(makeHabitData());
		expect(() => habit.updateName('')).toThrow('Name cannot be empty');
	});

	it('updateName() throws on whitespace-only', () => {
		const habit = Habit.fromData(makeHabitData());
		expect(() => habit.updateName('   ')).toThrow('Name cannot be empty');
	});

	it('updateEmoji() updates the emoji', () => {
		const habit = Habit.fromData(makeHabitData());
		habit.updateEmoji('🎯');
		expect(habit.emoji).toBe('🎯');
	});

	it('updateEmoji(undefined) clears the emoji', () => {
		const habit = Habit.fromData(makeHabitData({ emoji: '📚' }));
		habit.updateEmoji(undefined);
		expect(habit.emoji).toBeUndefined();
	});

	it('setSortOrder() updates sort order', () => {
		const habit = Habit.fromData(makeHabitData());
		habit.setSortOrder(5);
		expect(habit.sortOrder).toBe(5);
	});
});

describe('Habit serialization', () => {
	it('toJSON() returns plain data matching the input', () => {
		const data = makeHabitData();
		const habit = Habit.fromData(data);
		expect(habit.toJSON()).toEqual(data);
	});

	it('toJSON() returns an independent copy', () => {
		const habit = Habit.fromData(makeHabitData());
		const json = habit.toJSON();
		json.name = 'Modified';
		expect(habit.name).toBe('Read 30 minutes');
	});

	it('clone() returns an independent copy', () => {
		const habit = Habit.fromData(makeHabitData());
		const cloned = habit.clone();
		expect(cloned.toJSON()).toEqual(habit.toJSON());
		cloned.updateName('Different');
		expect(habit.name).toBe('Read 30 minutes');
		expect(cloned.name).toBe('Different');
	});
});
