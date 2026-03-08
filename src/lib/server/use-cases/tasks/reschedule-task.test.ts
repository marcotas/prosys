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

	it('reschedules a past task and creates a new copy', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());
		vi.mocked(repo.getNextSortOrder).mockReturnValue(3);

		const result = useCase.execute('task-1', '2026-03-08', 1);

		// Original marked as rescheduled
		expect(result.original.status).toBe('rescheduled');
		expect(repo.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-1', status: 'rescheduled' })
		);

		// New task created with correct info
		expect(result.newTask.title).toBe('Test task');
		expect(result.newTask.weekStart).toBe('2026-03-08');
		expect(result.newTask.dayIndex).toBe(1);
		expect(result.newTask.memberId).toBe('member-1');
		expect(result.newTask.rescheduleCount).toBe(1);
		expect(result.newTask.rescheduledFromId).toBe('task-1');
		expect(result.newTask.rescheduleHistory).toEqual([
			{ date: '2026-03-01', count: 1 }
		]);
		expect(result.newTask.sortOrder).toBe(3);
		expect(result.newTask.status).toBe('active');
		expect(repo.insert).toHaveBeenCalled();
	});

	it('preserves emoji on the new task', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask({ emoji: '🎯' }));

		const result = useCase.execute('task-1', '2026-03-08', 0);

		expect(result.newTask.emoji).toBe('🎯');
	});

	it('accumulates reschedule history for multiple reschedules', () => {
		const prevHistory = [{ date: '2026-02-22', count: 1 }];
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({
				weekStart: '2026-03-01',
				dayIndex: 2, // Mar 3
				rescheduleCount: 1,
				rescheduleHistory: prevHistory,
				rescheduledFromId: 'original-id'
			})
		);

		const result = useCase.execute('task-1', '2026-03-08', 0);

		expect(result.newTask.rescheduleCount).toBe(2);
		expect(result.newTask.rescheduleHistory).toEqual([
			{ date: '2026-02-22', count: 1 },
			{ date: '2026-03-03', count: 2 }
		]);
		expect(result.newTask.rescheduledFromId).toBe('task-1');
	});

	it('throws NotFoundError when task does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent', '2026-03-08', 0)).toThrow(NotFoundError);
	});

	it('throws ValidationError when task is not past (entity validates)', () => {
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({ weekStart: '2026-03-08', dayIndex: 0 })
		);

		expect(() => useCase.execute('task-1', '2026-03-15', 0)).toThrow(ValidationError);
		expect(() => useCase.execute('task-1', '2026-03-15', 0)).toThrow('Only past tasks can be rescheduled');
	});

	it('throws ConflictError when task is cancelled (entity validates)', () => {
		vi.mocked(repo.findById).mockReturnValue(
			makeTask({ status: 'cancelled', cancelledAt: '2026-03-01T00:00:00.000Z' })
		);

		expect(() => useCase.execute('task-1', '2026-03-08', 0)).toThrow(ConflictError);
	});

	it('throws ConflictError when task is already rescheduled (entity validates)', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask({ status: 'rescheduled' }));

		expect(() => useCase.execute('task-1', '2026-03-08', 0)).toThrow(ConflictError);
	});

	it('throws ValidationError when target date is in the past', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());

		// Target is 2026-03-01 dayIndex 0 = Mar 1 which is past
		expect(() => useCase.execute('task-1', '2026-03-01', 0)).toThrow(ValidationError);
		expect(() => useCase.execute('task-1', '2026-03-01', 0)).toThrow('Target date must be today or in the future');
	});

	it('allows target date of today', () => {
		vi.mocked(repo.findById).mockReturnValue(makeTask());

		// Today is Mar 7, 2026 (Saturday = dayIndex 6 in week starting 2026-03-01)
		const result = useCase.execute('task-1', '2026-03-01', 6);

		expect(result.newTask.weekStart).toBe('2026-03-01');
		expect(result.newTask.dayIndex).toBe(6);
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
