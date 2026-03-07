import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteHabit } from './delete-habit';
import type { HabitData } from '$lib/domain/types';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { NotFoundError } from '$lib/server/domain/errors';

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

describe('DeleteHabit', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: DeleteHabit;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new DeleteHabit(repo);
	});

	it('deletes an existing habit and returns id + memberId', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);

		const result = useCase.execute('habit-1');

		expect(result).toEqual({ id: 'habit-1', memberId: 'member-1' });
		expect(repo.delete).toHaveBeenCalledWith('habit-1');
	});

	it('throws NotFoundError when habit does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent')).toThrow(NotFoundError);
	});

	it('does not call delete when habit is not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent');
		} catch {
			// expected
		}

		expect(repo.delete).not.toHaveBeenCalled();
	});

	it('calls findById with the correct ID', () => {
		vi.mocked(repo.findById).mockReturnValue(sampleHabit);

		useCase.execute('habit-1');

		expect(repo.findById).toHaveBeenCalledWith('habit-1');
	});
});
