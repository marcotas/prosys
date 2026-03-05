import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateHabit } from './create-habit';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';

// -- Mock Repository -----------------------------------------------

function makeMockRepo(): HabitRepository {
	return {
		findById: vi.fn(),
		findByMember: vi.fn(),
		findByMemberWithCompletions: vi.fn(),
		findFamilyWithCompletions: vi.fn(),
		getNextSortOrder: vi.fn().mockReturnValue(0),
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

describe('CreateHabit', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: CreateHabit;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new CreateHabit(repo);
	});

	it('creates a habit with valid input and returns HabitData', () => {
		vi.mocked(repo.getNextSortOrder).mockReturnValue(3);

		const result = useCase.execute({
			memberId: 'member-1',
			name: 'Exercise',
			emoji: '🏃'
		});

		expect(result.id).toBeTruthy();
		expect(result.name).toBe('Exercise');
		expect(result.memberId).toBe('member-1');
		expect(result.emoji).toBe('🏃');
		expect(result.sortOrder).toBe(3);
	});

	it('calls getNextSortOrder with the member ID', () => {
		useCase.execute({
			memberId: 'member-1',
			name: 'Read'
		});

		expect(repo.getNextSortOrder).toHaveBeenCalledWith('member-1');
	});

	it('calls insert with the habit data', () => {
		const result = useCase.execute({
			memberId: 'member-1',
			name: 'Meditate'
		});

		expect(repo.insert).toHaveBeenCalledWith(result);
	});

	it('creates habit without emoji', () => {
		const result = useCase.execute({
			memberId: 'member-1',
			name: 'Study'
		});

		expect(result.emoji).toBeUndefined();
	});

	it('trims the habit name', () => {
		const result = useCase.execute({
			memberId: 'member-1',
			name: '  Walk the dog  '
		});

		expect(result.name).toBe('Walk the dog');
	});

	it('throws on empty name', () => {
		expect(() =>
			useCase.execute({ memberId: 'member-1', name: '' })
		).toThrow('Name is required');
	});

	it('throws on whitespace-only name', () => {
		expect(() =>
			useCase.execute({ memberId: 'member-1', name: '   ' })
		).toThrow('Name is required');
	});

	it('throws on empty memberId', () => {
		expect(() =>
			useCase.execute({ memberId: '', name: 'Exercise' })
		).toThrow('Member ID is required');
	});

	it('throws on whitespace-only memberId', () => {
		expect(() =>
			useCase.execute({ memberId: '   ', name: 'Exercise' })
		).toThrow('Member ID is required');
	});

	it('does not call insert when validation fails', () => {
		try {
			useCase.execute({ memberId: '', name: '' });
		} catch {
			// expected
		}

		expect(repo.insert).not.toHaveBeenCalled();
	});

	it('does not call getNextSortOrder when validation fails', () => {
		try {
			useCase.execute({ memberId: '', name: '' });
		} catch {
			// expected
		}

		expect(repo.getNextSortOrder).not.toHaveBeenCalled();
	});
});
