import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMemberTasks } from './get-member-tasks';
import type { TaskData } from '$lib/domain/types';
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

function makeTaskData(overrides: Partial<TaskData> = {}): TaskData {
	return {
		id: 'task-1',
		memberId: 'member-1',
		weekStart: '2026-03-01',
		dayIndex: 0,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		status: 'active',
		cancelledAt: null,
		...overrides
	};
}

// ── Tests ──────────────────────────────────────────────

describe('GetMemberTasks', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: GetMemberTasks;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new GetMemberTasks(repo);
	});

	it('returns tasks for a member and week', () => {
		const tasks = [
			makeTaskData({ id: 'task-1', dayIndex: 0, sortOrder: 0 }),
			makeTaskData({ id: 'task-2', dayIndex: 1, sortOrder: 0 })
		];
		vi.mocked(repo.findByMemberAndWeek).mockReturnValue(tasks);

		const result = useCase.execute('member-1', '2026-03-01');

		expect(result).toEqual(tasks);
		expect(repo.findByMemberAndWeek).toHaveBeenCalledWith('member-1', '2026-03-01');
	});

	it('returns empty array when no tasks exist', () => {
		vi.mocked(repo.findByMemberAndWeek).mockReturnValue([]);

		const result = useCase.execute('member-1', '2026-03-01');

		expect(result).toEqual([]);
	});

	it('throws ValidationError when weekStart is empty', () => {
		expect(() => useCase.execute('member-1', '')).toThrow(ValidationError);
		expect(() => useCase.execute('member-1', '')).toThrow('Missing week parameter');
	});

	it('does not call repository when validation fails', () => {
		try {
			useCase.execute('member-1', '');
		} catch {
			// expected
		}

		expect(repo.findByMemberAndWeek).not.toHaveBeenCalled();
	});
});
