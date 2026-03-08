import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTask } from './update-task';
import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
import { NotFoundError } from '$lib/server/domain/errors';

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

function makeTask(overrides: Partial<TaskData> = {}): Task {
	return Task.fromData(makeTaskData(overrides));
}

// ── Tests ──────────────────────────────────────────────

describe('UpdateTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: UpdateTask;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new UpdateTask(repo);
	});

	it('updates a task and returns updated data', () => {
		const updatedData = makeTaskData({ title: 'Updated title' });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask()) // first call: check existence
			.mockReturnValueOnce(makeTask({ title: 'Updated title' })); // second call: return updated

		const result = useCase.execute('task-1', { title: 'Updated title' });

		expect(result.task).toEqual(updatedData);
		expect(repo.updatePartial).toHaveBeenCalledWith('task-1', { title: 'Updated title' });
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent', { title: 'Test' })).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent', { title: 'Test' })).toThrow('Task not found: nonexistent');
	});

	it('detects move when dayIndex changes', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask({ dayIndex: 0 }))
			.mockReturnValueOnce(makeTask({ dayIndex: 3 }));

		const result = useCase.execute('task-1', { dayIndex: 3 });

		expect(result.isMoved).toBe(true);
		expect(result.fromDay).toBe(0);
		expect(result.fromWeek).toBe('2026-03-01');
	});

	it('detects move when weekStart changes', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask({ weekStart: '2026-03-01' }))
			.mockReturnValueOnce(makeTask({ weekStart: '2026-03-08' }));

		const result = useCase.execute('task-1', { weekStart: '2026-03-08' });

		expect(result.isMoved).toBe(true);
		expect(result.fromWeek).toBe('2026-03-01');
	});

	it('does not detect move when only title changes', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask())
			.mockReturnValueOnce(makeTask({ title: 'New title' }));

		const result = useCase.execute('task-1', { title: 'New title' });

		expect(result.isMoved).toBe(false);
	});

	it('does not detect move when same dayIndex is provided', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask({ dayIndex: 2 }))
			.mockReturnValueOnce(makeTask({ dayIndex: 2, title: 'Changed' }));

		const result = useCase.execute('task-1', { dayIndex: 2, title: 'Changed' });

		expect(result.isMoved).toBe(false);
	});

	it('handles completion toggle', () => {
		vi.mocked(repo.findById)
			.mockReturnValueOnce(makeTask({ completed: false }))
			.mockReturnValueOnce(makeTask({ completed: true }));

		const result = useCase.execute('task-1', { completed: true });

		expect(result.task.completed).toBe(true);
		expect(result.isMoved).toBe(false);
	});

	it('does not call updatePartial when task not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent', { title: 'Test' });
		} catch {
			// expected
		}

		expect(repo.updatePartial).not.toHaveBeenCalled();
	});
});
