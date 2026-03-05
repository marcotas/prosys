import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReorderHabits } from './reorder-habits';
import { ValidationError } from '$lib/server/domain/errors';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';

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

// -- Tests --------------------------------------------------------

describe('ReorderHabits', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: ReorderHabits;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new ReorderHabits(repo);
	});

	it('reorders habits when all IDs belong to the member', () => {
		vi.mocked(repo.findIdsByMember).mockReturnValue(['h1', 'h2', 'h3']);

		useCase.execute({ memberId: 'member-1', habitIds: ['h3', 'h1', 'h2'] });

		expect(repo.reorder).toHaveBeenCalledWith(
			['h3', 'h1', 'h2'],
			expect.any(String)
		);
	});

	it('throws ValidationError when memberId is empty', () => {
		expect(() =>
			useCase.execute({ memberId: '', habitIds: ['h1'] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: '', habitIds: ['h1'] })
		).toThrow('memberId is required');
	});

	it('throws ValidationError when memberId is whitespace', () => {
		expect(() =>
			useCase.execute({ memberId: '   ', habitIds: ['h1'] })
		).toThrow(ValidationError);
	});

	it('throws ValidationError when habitIds is empty array', () => {
		expect(() =>
			useCase.execute({ memberId: 'member-1', habitIds: [] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: 'member-1', habitIds: [] })
		).toThrow('habitIds must be a non-empty array');
	});

	it('throws ValidationError when a habit ID does not belong to the member', () => {
		vi.mocked(repo.findIdsByMember).mockReturnValue(['h1', 'h2']);

		expect(() =>
			useCase.execute({ memberId: 'member-1', habitIds: ['h1', 'h3'] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: 'member-1', habitIds: ['h1', 'h3'] })
		).toThrow('Habit h3 not found for this member');
	});

	it('does not call reorder when validation fails', () => {
		try {
			useCase.execute({ memberId: '', habitIds: [] });
		} catch {
			// expected
		}

		expect(repo.reorder).not.toHaveBeenCalled();
	});

	it('does not call findIdsByMember when memberId validation fails', () => {
		try {
			useCase.execute({ memberId: '', habitIds: ['h1'] });
		} catch {
			// expected
		}

		expect(repo.findIdsByMember).not.toHaveBeenCalled();
	});

	it('calls findIdsByMember with the correct memberId', () => {
		vi.mocked(repo.findIdsByMember).mockReturnValue(['h1']);

		useCase.execute({ memberId: 'member-1', habitIds: ['h1'] });

		expect(repo.findIdsByMember).toHaveBeenCalledWith('member-1');
	});

	it('passes a valid ISO timestamp to reorder', () => {
		vi.mocked(repo.findIdsByMember).mockReturnValue(['h1']);

		useCase.execute({ memberId: 'member-1', habitIds: ['h1'] });

		const timestamp = vi.mocked(repo.reorder).mock.calls[0][1];
		expect(() => new Date(timestamp)).not.toThrow();
		expect(new Date(timestamp).toISOString()).toBe(timestamp);
	});
});
