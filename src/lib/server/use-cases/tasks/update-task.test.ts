import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTask } from './update-task';
import { NotFoundError } from '$lib/server/domain/errors';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import type { TaskData } from '$lib/domain/types';

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
		...overrides
	};
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
		const existing = makeTaskData();
		const updated = makeTaskData({ title: 'Updated title' });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing) // first call: check existence
			.mockReturnValueOnce(updated); // second call: return updated

		const result = useCase.execute('task-1', { title: 'Updated title' });

		expect(result.task).toEqual(updated);
		expect(repo.updatePartial).toHaveBeenCalledWith('task-1', { title: 'Updated title' });
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent', { title: 'Test' })).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent', { title: 'Test' })).toThrow('Task not found: nonexistent');
	});

	it('detects move when dayIndex changes', () => {
		const existing = makeTaskData({ dayIndex: 0 });
		const updated = makeTaskData({ dayIndex: 3 });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('task-1', { dayIndex: 3 });

		expect(result.isMoved).toBe(true);
		expect(result.fromDay).toBe(0);
		expect(result.fromWeek).toBe('2026-03-01');
	});

	it('detects move when weekStart changes', () => {
		const existing = makeTaskData({ weekStart: '2026-03-01' });
		const updated = makeTaskData({ weekStart: '2026-03-08' });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('task-1', { weekStart: '2026-03-08' });

		expect(result.isMoved).toBe(true);
		expect(result.fromWeek).toBe('2026-03-01');
	});

	it('does not detect move when only title changes', () => {
		const existing = makeTaskData();
		const updated = makeTaskData({ title: 'New title' });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('task-1', { title: 'New title' });

		expect(result.isMoved).toBe(false);
	});

	it('does not detect move when same dayIndex is provided', () => {
		const existing = makeTaskData({ dayIndex: 2 });
		const updated = makeTaskData({ dayIndex: 2, title: 'Changed' });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('task-1', { dayIndex: 2, title: 'Changed' });

		expect(result.isMoved).toBe(false);
	});

	it('handles completion toggle', () => {
		const existing = makeTaskData({ completed: false });
		const updated = makeTaskData({ completed: true });

		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

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
