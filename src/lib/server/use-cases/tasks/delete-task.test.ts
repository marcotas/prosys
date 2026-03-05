import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteTask } from './delete-task';
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
		dayIndex: 2,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		...overrides
	};
}

// ── Tests ──────────────────────────────────────────────

describe('DeleteTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: DeleteTask;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new DeleteTask(repo);
	});

	it('deletes a task and returns its context info', () => {
		const existing = makeTaskData({ memberId: 'member-1', weekStart: '2026-03-01', dayIndex: 2 });
		vi.mocked(repo.findById).mockReturnValue(existing);

		const result = useCase.execute('task-1');

		expect(result).toEqual({
			id: 'task-1',
			memberId: 'member-1',
			weekStart: '2026-03-01',
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
		vi.mocked(repo.findById).mockReturnValue(existing);

		const result = useCase.execute('task-1');

		expect(result.memberId).toBeNull();
	});
});
