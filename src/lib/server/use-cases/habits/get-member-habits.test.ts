import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMemberHabits } from './get-member-habits';
import { ValidationError } from '$lib/server/domain/errors';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import type { HabitWithDays } from '$lib/types';

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

const sampleHabitsWithDays: HabitWithDays[] = [
	{
		id: 'h1',
		memberId: 'member-1',
		name: 'Exercise',
		sortOrder: 0,
		days: [true, false, true, false, false, false, false]
	},
	{
		id: 'h2',
		memberId: 'member-1',
		name: 'Read',
		emoji: '📖',
		sortOrder: 1,
		days: [false, true, false, true, false, false, false]
	}
];

// -- Tests --------------------------------------------------------

describe('GetMemberHabits', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: GetMemberHabits;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new GetMemberHabits(repo);
	});

	it('returns habits with days for a member', () => {
		vi.mocked(repo.findByMemberWithCompletions).mockReturnValue(sampleHabitsWithDays);

		const result = useCase.execute('member-1', '2026-03-01');

		expect(result).toEqual(sampleHabitsWithDays);
		expect(repo.findByMemberWithCompletions).toHaveBeenCalledWith('member-1', '2026-03-01');
	});

	it('returns empty array when member has no habits', () => {
		vi.mocked(repo.findByMemberWithCompletions).mockReturnValue([]);

		const result = useCase.execute('member-1', '2026-03-01');

		expect(result).toEqual([]);
	});

	it('throws ValidationError when weekStart is missing', () => {
		expect(() =>
			useCase.execute('member-1', '')
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute('member-1', '')
		).toThrow('Missing week parameter');
	});

	it('does not call repository when validation fails', () => {
		try {
			useCase.execute('member-1', '');
		} catch {
			// expected
		}

		expect(repo.findByMemberWithCompletions).not.toHaveBeenCalled();
	});
});
