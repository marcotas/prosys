import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RescheduleTask } from './reschedule-task';
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
		getNextSortOrder: vi.fn().mockReturnValue(0),
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

describe('RescheduleTask', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: RescheduleTask;

	beforeEach(() => {
		// Freeze to 2026-03-07 so default task data (2026-03-01 dayIndex 0) is past
		vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
		repo = makeMockRepo();
		useCase = new RescheduleTask(repo);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('persists original as rescheduled and inserts new task', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());
		vi.mocked(repo.getNextSortOrder).mockReturnValue(3);

		const result = useCase.execute('task-1', '2026-03-08', 1);

		// Original persisted as rescheduled
		expect(repo.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-1', status: 'rescheduled' })
		);

		// New task inserted with sort order from repo
		expect(result.newTask.sortOrder).toBe(3);
		expect(repo.insert).toHaveBeenCalled();
	});

	it('assigns sort order from repository to new task', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());
		vi.mocked(repo.getNextSortOrder).mockReturnValue(7);

		const result = useCase.execute('task-1', '2026-03-08', 2);

		expect(repo.getNextSortOrder).toHaveBeenCalledWith('member-1', '2026-03-08', 2);
		expect(result.newTask.sortOrder).toBe(7);
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent', '2026-03-08', 0)).toThrow(NotFoundError);
	});

	it('propagates ValidationError from entity (not past)', () => {
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({ weekStart: '2026-03-08', dayIndex: 0 })
		);

		expect(() => useCase.execute('task-1', '2026-03-15', 0)).toThrow(ValidationError);
	});

	it('propagates ConflictError from entity (cancelled)', () => {
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({ status: 'cancelled', cancelledAt: '2026-03-01T00:00:00.000Z' })
		);

		expect(() => useCase.execute('task-1', '2026-03-08', 0)).toThrow(ConflictError);
	});

	it('propagates ConflictError from entity (already rescheduled)', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask({ status: 'rescheduled' }));

		expect(() => useCase.execute('task-1', '2026-03-08', 0)).toThrow(ConflictError);
	});

	it('does not call insert or update when validation fails', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent', '2026-03-08', 0);
		} catch {
			// expected
		}

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).not.toHaveBeenCalled();
	});
});
