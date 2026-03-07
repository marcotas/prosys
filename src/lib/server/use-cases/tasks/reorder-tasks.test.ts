import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReorderTasks } from './reorder-tasks';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { ValidationError } from '$lib/server/domain/errors';

// ── Mock Repository ────────────────────────────────────

function makeMockRepo(): TaskRepository {
	return {
		findById: vi.fn(),
		findByMemberAndWeek: vi.fn(),
		findFamilyWeek: vi.fn(),
		getNextSortOrder: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		updatePartial: vi.fn(),
		delete: vi.fn(),
		reorder: vi.fn(),
		findIdsByDay: vi.fn()
	} as unknown as TaskRepository;
}

// ── Tests ──────────────────────────────────────────────

describe('ReorderTasks', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: ReorderTasks;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new ReorderTasks(repo);
	});

	it('reorders tasks with valid input', () => {
		vi.mocked(repo.findIdsByDay).mockReturnValue(['task-1', 'task-2', 'task-3']);

		useCase.execute({
			memberId: 'member-1',
			weekStart: '2026-03-01',
			dayIndex: 0,
			taskIds: ['task-3', 'task-1', 'task-2']
		});

		expect(repo.reorder).toHaveBeenCalledWith(
			['task-3', 'task-1', 'task-2'],
			expect.any(String) // ISO date string
		);
	});

	it('validates weekStart is required', () => {
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '', dayIndex: 0, taskIds: ['task-1'] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '', dayIndex: 0, taskIds: ['task-1'] })
		).toThrow('weekStart is required');
	});

	it('validates weekStart is not whitespace-only', () => {
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '   ', dayIndex: 0, taskIds: ['task-1'] })
		).toThrow(ValidationError);
	});

	it('validates dayIndex must be 0-6', () => {
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: -1, taskIds: ['task-1'] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: 7, taskIds: ['task-1'] })
		).toThrow(ValidationError);
	});

	it('validates taskIds must be a non-empty array', () => {
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: 0, taskIds: [] })
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: 0, taskIds: [] })
		).toThrow('taskIds must be a non-empty array');
	});

	it('validates all taskIds exist in the day', () => {
		vi.mocked(repo.findIdsByDay).mockReturnValue(['task-1', 'task-2']);

		expect(() =>
			useCase.execute({
				memberId: 'member-1',
				weekStart: '2026-03-01',
				dayIndex: 0,
				taskIds: ['task-1', 'task-3']
			})
		).toThrow(ValidationError);
		expect(() =>
			useCase.execute({
				memberId: 'member-1',
				weekStart: '2026-03-01',
				dayIndex: 0,
				taskIds: ['task-1', 'task-3']
			})
		).toThrow('Task task-3 not found in this day');
	});

	it('resolves empty string memberId to null', () => {
		vi.mocked(repo.findIdsByDay).mockReturnValue(['task-1']);

		useCase.execute({
			memberId: '',
			weekStart: '2026-03-01',
			dayIndex: 0,
			taskIds: ['task-1']
		});

		expect(repo.findIdsByDay).toHaveBeenCalledWith(null, '2026-03-01', 0);
	});

	it('resolves undefined memberId to null', () => {
		vi.mocked(repo.findIdsByDay).mockReturnValue(['task-1']);

		useCase.execute({
			weekStart: '2026-03-01',
			dayIndex: 0,
			taskIds: ['task-1']
		});

		expect(repo.findIdsByDay).toHaveBeenCalledWith(null, '2026-03-01', 0);
	});

	it('accepts boundary dayIndex values 0 and 6', () => {
		vi.mocked(repo.findIdsByDay).mockReturnValue(['task-1']);

		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: 0, taskIds: ['task-1'] })
		).not.toThrow();

		expect(() =>
			useCase.execute({ memberId: null, weekStart: '2026-03-01', dayIndex: 6, taskIds: ['task-1'] })
		).not.toThrow();
	});

	it('does not call reorder when validation fails', () => {
		try {
			useCase.execute({ memberId: null, weekStart: '', dayIndex: 0, taskIds: ['task-1'] });
		} catch {
			// expected
		}

		expect(repo.reorder).not.toHaveBeenCalled();
	});
});
