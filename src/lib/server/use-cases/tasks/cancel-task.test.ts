import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelTask } from './cancel-task';
import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
import { NotFoundError, ValidationError, ConflictError } from '$lib/server/domain/errors';

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
		weekStart: '2026-03-01', // past Sunday
		dayIndex: 0,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		status: 'active',
		cancelledAt: null,
		rescheduleCount: 0,
		rescheduleHistory: null,
		rescheduledFromId: null,
		...overrides
	};
}

function makeTask(overrides: Partial<TaskData> = {}): Task {
	return Task.fromData(makeTaskData(overrides));
}

// ── Tests ──────────────────────────────────────────────

describe('CancelTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: CancelTask;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new CancelTask(repo);
	});

	it('cancels a past task and returns updated data', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());

		const result = useCase.execute('task-1');

		expect(result.status).toBe('cancelled');
		expect(result.cancelledAt).toBeTruthy();
		expect(repo.update).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'cancelled' })
		);
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent')).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent')).toThrow('Task not found: nonexistent');
	});

	it('throws ValidationError when task is not past (entity validates)', () => {
		// Use a future date so isPast returns false
		vi.mocked(repo.findById).mockReturnValue(makeTask({ weekStart: '2099-03-02', dayIndex: 0 }));

		expect(() => useCase.execute('task-1')).toThrow(ValidationError);
		expect(() => useCase.execute('task-1')).toThrow('Only past tasks can be cancelled');
	});

	it('throws ConflictError when task is already cancelled (entity validates)', () => {
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({ status: 'cancelled', cancelledAt: '2026-03-01T00:00:00.000Z' })
		);

		expect(() => useCase.execute('task-1')).toThrow(ConflictError);
		expect(() => useCase.execute('task-1')).toThrow('Task is already cancelled');
	});

	it('does not call update when task is not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent');
		} catch {
			// expected
		}

		expect(repo.update).not.toHaveBeenCalled();
	});

	it('does not call update when task is not past', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask({ weekStart: '2099-03-02', dayIndex: 0 }));

		try {
			useCase.execute('task-1');
		} catch {
			// expected
		}

		expect(repo.update).not.toHaveBeenCalled();
	});
});
