import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTask } from './create-task';
import type { TaskRepository } from '$lib/server/repositories/task-repository';

// ── Mock Repository ────────────────────────────────────

function makeMockRepo(): TaskRepository {
	return {
		findById: vi.fn(),
		findByMemberAndWeek: vi.fn(),
		findFamilyWeek: vi.fn(),
		getNextSortOrder: vi.fn().mockReturnValue(0),
		insert: vi.fn(),
		update: vi.fn(),
		updatePartial: vi.fn(),
		delete: vi.fn(),
		reorder: vi.fn(),
		findIdsByDay: vi.fn()
	} as unknown as TaskRepository;
}

// ── Tests ──────────────────────────────────────────────

describe('CreateTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: CreateTask;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new CreateTask(repo);
	});

	it('creates a task with valid input and returns TaskData', () => {
		vi.mocked(repo.getNextSortOrder).mockReturnValue(3);

		const result = useCase.execute({
			memberId: 'member-1',
			weekStart: '2026-03-01',
			dayIndex: 1,
			title: 'Buy groceries',
			emoji: '🛒'
		});

		expect(result.id).toBeTruthy();
		expect(result.title).toBe('Buy groceries');
		expect(result.memberId).toBe('member-1');
		expect(result.weekStart).toBe('2026-03-01');
		expect(result.dayIndex).toBe(1);
		expect(result.emoji).toBe('🛒');
		expect(result.completed).toBe(false);
		expect(result.sortOrder).toBe(3);
	});

	it('calls getNextSortOrder with the correct arguments', () => {
		useCase.execute({
			memberId: 'member-1',
			weekStart: '2026-03-01',
			dayIndex: 2,
			title: 'Test'
		});

		expect(repo.getNextSortOrder).toHaveBeenCalledWith('member-1', '2026-03-01', 2);
	});

	it('calls insert with the task data', () => {
		const result = useCase.execute({
			memberId: 'member-1',
			weekStart: '2026-03-01',
			dayIndex: 0,
			title: 'Test'
		});

		expect(repo.insert).toHaveBeenCalledWith(result);
	});

	it('defaults memberId to null when not provided', () => {
		vi.mocked(repo.getNextSortOrder).mockReturnValue(0);

		const result = useCase.execute({
			weekStart: '2026-03-01',
			dayIndex: 0,
			title: 'Family task'
		});

		expect(result.memberId).toBeNull();
		expect(repo.getNextSortOrder).toHaveBeenCalledWith(null, '2026-03-01', 0);
	});

	it('throws on empty title', () => {
		expect(() =>
			useCase.execute({ weekStart: '2026-03-01', dayIndex: 0, title: '' })
		).toThrow('Title is required');
	});

	it('throws on invalid dayIndex', () => {
		expect(() =>
			useCase.execute({ weekStart: '2026-03-01', dayIndex: 7, title: 'Test' })
		).toThrow('Day index must be 0-6');
	});

	it('throws on non-Sunday weekStart', () => {
		expect(() =>
			useCase.execute({ weekStart: '2026-03-02', dayIndex: 0, title: 'Test' })
		).toThrow('Week must start on Sunday');
	});

	it('throws on missing weekStart', () => {
		expect(() =>
			useCase.execute({ weekStart: '', dayIndex: 0, title: 'Test' })
		).toThrow('Week start is required');
	});

	it('does not call insert when validation fails', () => {
		try {
			useCase.execute({ weekStart: '', dayIndex: 0, title: '' });
		} catch {
			// expected
		}

		expect(repo.insert).not.toHaveBeenCalled();
	});
});
