import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleHabit } from './toggle-habit';
import type { HabitData } from '$lib/domain/types';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';

// -- Mock Repository -----------------------------------------------

function makeMockRepo(): HabitRepository {
	return {
		findById: vi.fn(),
		findByMember: vi.fn(),
		findByMemberWithCompletions: vi.fn(),
		findFamilyWithCompletions: vi.fn(),
		getNextSortOrder: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		updatePartial: vi.fn(),
		delete: vi.fn(),
		reorder: vi.fn(),
		findIdsByMember: vi.fn(),
		findCompletion: vi.fn(),
		insertCompletion: vi.fn(),
		deleteCompletion: vi.fn()
	} as unknown as HabitRepository;
}

const sampleHabit: HabitData = {
	id: 'habit-1',
	memberId: 'member-1',
	name: 'Exercise',
	emoji: '🏃',
	sortOrder: 0
};

// -- Tests --------------------------------------------------------

describe('ToggleHabit', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: ToggleHabit;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new ToggleHabit(repo);
	});

	it('completes a habit when no completion exists', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);
		vi.mocked(repo.findCompletion).mockReturnValue(false);

		const result = useCase.execute('habit-1', '2026-03-01', 1);

		expect(result).toEqual({ completed: true });
		expect(repo.insertCompletion).toHaveBeenCalledWith('habit-1', '2026-03-01', 1);
		expect(repo.deleteCompletion).not.toHaveBeenCalled();
	});

	it('uncompletes a habit when completion already exists', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);
		vi.mocked(repo.findCompletion).mockReturnValue(true);

		const result = useCase.execute('habit-1', '2026-03-01', 1);

		expect(result).toEqual({ completed: false });
		expect(repo.deleteCompletion).toHaveBeenCalledWith('habit-1', '2026-03-01', 1);
		expect(repo.insertCompletion).not.toHaveBeenCalled();
	});

	it('throws NotFoundError when habit does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() =>
			useCase.execute('nonexistent', '2026-03-01', 1)
		).toThrow(NotFoundError);
	});

	it('throws ValidationError when weekStart is empty', () => {
		expect(() =>
			useCase.execute('habit-1', '', 1)
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute('habit-1', '', 1)
		).toThrow('weekStart is required');
	});

	it('throws ValidationError when weekStart is whitespace', () => {
		expect(() =>
			useCase.execute('habit-1', '   ', 1)
		).toThrow(ValidationError);
	});

	it('throws ValidationError when dayIndex is negative', () => {
		expect(() =>
			useCase.execute('habit-1', '2026-03-01', -1)
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute('habit-1', '2026-03-01', -1)
		).toThrow('dayIndex must be 0-6');
	});

	it('throws ValidationError when dayIndex is greater than 6', () => {
		expect(() =>
			useCase.execute('habit-1', '2026-03-01', 7)
		).toThrow(ValidationError);
	});

	it('accepts dayIndex 0 (Sunday)', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);
		vi.mocked(repo.findCompletion).mockReturnValue(false);

		const result = useCase.execute('habit-1', '2026-03-01', 0);
		expect(result.completed).toBe(true);
	});

	it('accepts dayIndex 6 (Saturday)', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);
		vi.mocked(repo.findCompletion).mockReturnValue(false);

		const result = useCase.execute('habit-1', '2026-03-01', 6);
		expect(result.completed).toBe(true);
	});

	it('does not call findCompletion when habit not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent', '2026-03-01', 1);
		} catch {
			// expected
		}

		expect(repo.findCompletion).not.toHaveBeenCalled();
	});

	it('does not call findById when validation fails', () => {
		try {
			useCase.execute('habit-1', '', 1);
		} catch {
			// expected
		}

		expect(repo.findById).not.toHaveBeenCalled();
	});
});
