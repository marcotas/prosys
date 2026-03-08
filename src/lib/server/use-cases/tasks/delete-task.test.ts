import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeleteTask } from './delete-task';
import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';

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
		weekStart: '2099-03-02', // future Sunday — deletable
		dayIndex: 2,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		status: 'active',
		cancelledAt: null,
		...overrides
	};
}

// ── Tests ──────────────────────────────────────────────

describe('DeleteTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: DeleteTask;

	beforeEach(() => {
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
		repo = makeMockRepo();
		useCase = new DeleteTask(repo);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('deletes a task and returns its context info', () => {
		const existing = makeTaskData({ memberId: 'member-1', weekStart: '2099-03-02', dayIndex: 2 });
		vi.mocked(repo.findById).mockReturnValue(Task.fromData(existing));

		const result = useCase.execute('task-1');

		expect(result).toEqual({
			id: 'task-1',
			memberId: 'member-1',
			weekStart: '2099-03-02',
			dayIndex: 2
		});
		expect(repo.delete).toHaveBeenCalledWith('task-1');
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent')).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent')).toThrow('Task not found: nonexistent');
	});

	it('does not call delete when task not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent');
		} catch {
			// expected
		}

		expect(repo.delete).not.toHaveBeenCalled();
	});

	it('handles task with null memberId', () => {
		const existing = makeTaskData({ memberId: null });
		vi.mocked(repo.findById).mockReturnValue(Task.fromData(existing));

		const result = useCase.execute('task-1');

		expect(result.memberId).toBeNull();
	});

	it('throws ValidationError when deleting a past task', () => {
		// Use a past date
		vi.mocked(repo.findById).mockReturnValue(
			Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 0 }))
		);

		expect(() => useCase.execute('task-1')).toThrow(ValidationError);
		expect(() => useCase.execute('task-1')).toThrow('Cannot delete past tasks; use cancel instead');
	});

	it('does not call delete for past tasks', () => {
		vi.mocked(repo.findById).mockReturnValue(
			Task.fromData(makeTaskData({ weekStart: '2026-03-01', dayIndex: 0 }))
		);

		try {
			useCase.execute('task-1');
		} catch {
			// expected
		}

		expect(repo.delete).not.toHaveBeenCalled();
	});
});
