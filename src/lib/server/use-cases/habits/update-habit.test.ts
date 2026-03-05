import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateHabit } from './update-habit';
import { NotFoundError } from '$lib/server/domain/errors';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import type { HabitData } from '$lib/domain/types';

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

describe('UpdateHabit', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: UpdateHabit;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new UpdateHabit(repo);
	});

	it('updates habit name and returns updated data', () => {
		const updatedHabit = { ...sampleHabit, name: 'Yoga' };
		vi.mocked(repo.findById)
			.mockReturnValueOnce(sampleHabit)
			.mockReturnValueOnce(updatedHabit);

		const result = useCase.execute('habit-1', { name: 'Yoga' });

		expect(result.name).toBe('Yoga');
		expect(repo.updatePartial).toHaveBeenCalledWith('habit-1', { name: 'Yoga' });
	});

	it('updates habit emoji', () => {
		const updatedHabit = { ...sampleHabit, emoji: '🧘' };
		vi.mocked(repo.findById)
			.mockReturnValueOnce(sampleHabit)
			.mockReturnValueOnce(updatedHabit);

		const result = useCase.execute('habit-1', { emoji: '🧘' });

		expect(result.emoji).toBe('🧘');
		expect(repo.updatePartial).toHaveBeenCalledWith('habit-1', { emoji: '🧘' });
	});

	it('updates both name and emoji', () => {
		const updatedHabit = { ...sampleHabit, name: 'Yoga', emoji: '🧘' };
		vi.mocked(repo.findById)
			.mockReturnValueOnce(sampleHabit)
			.mockReturnValueOnce(updatedHabit);

		const result = useCase.execute('habit-1', { name: 'Yoga', emoji: '🧘' });

		expect(result.name).toBe('Yoga');
		expect(result.emoji).toBe('🧘');
	});

	it('throws NotFoundError when habit does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() =>
			useCase.execute('nonexistent', { name: 'Test' })
		).toThrow(NotFoundError);
	});

	it('does not call updatePartial when habit is not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent', { name: 'Test' });
		} catch {
			// expected
		}

		expect(repo.updatePartial).not.toHaveBeenCalled();
	});

	it('calls findById twice: once to check existence, once to return updated data', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(sampleHabit)
			.mockReturnValueOnce(sampleHabit);

		useCase.execute('habit-1', { name: 'Updated' });

		expect(repo.findById).toHaveBeenCalledTimes(2);
	});
});
