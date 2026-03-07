import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetFamilyHabits } from './get-family-habits';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import type { FamilyHabitProgress } from '$lib/types';
import { ValidationError } from '$lib/server/domain/errors';

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

const sampleFamilyProgress: FamilyHabitProgress[] = [
	{
		memberId: 'member-1',
		memberName: 'Alice',
		theme: {
			variant: 'default',
			accent: '#4a7c59',
			accentLight: '#dcfce7',
			accentDark: '#1e3a24',
			headerBg: '#4a7c59',
			ringColor: '#4a7c59',
			checkColor: '#4a7c59',
			emoji: ''
		},
		habits: [
			{
				id: 'h1',
				memberId: 'member-1',
				name: 'Exercise',
				sortOrder: 0,
				days: [true, false, true, false, false, false, false]
			}
		]
	}
];

// -- Tests --------------------------------------------------------

describe('GetFamilyHabits', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: GetFamilyHabits;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new GetFamilyHabits(repo);
	});

	it('returns family habit progress data', () => {
		vi.mocked(repo.findFamilyWithCompletions).mockReturnValue(sampleFamilyProgress);

		const result = useCase.execute('2026-03-01');

		expect(result).toEqual(sampleFamilyProgress);
		expect(repo.findFamilyWithCompletions).toHaveBeenCalledWith('2026-03-01');
	});

	it('returns empty array when no members exist', () => {
		vi.mocked(repo.findFamilyWithCompletions).mockReturnValue([]);

		const result = useCase.execute('2026-03-01');

		expect(result).toEqual([]);
	});

	it('throws ValidationError when weekStart is missing', () => {
		expect(() =>
			useCase.execute('')
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute('')
		).toThrow('week parameter is required');
	});

	it('does not call repository when validation fails', () => {
		try {
			useCase.execute('');
		} catch {
			// expected
		}

		expect(repo.findFamilyWithCompletions).not.toHaveBeenCalled();
	});
});
