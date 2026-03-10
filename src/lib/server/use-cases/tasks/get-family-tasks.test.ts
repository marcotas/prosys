import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetFamilyTasks } from './get-family-tasks';
import type { TaskRepository, PlannerTaskRow } from '$lib/server/repositories/task-repository';
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

function makePlannerTaskRow(overrides: Partial<PlannerTaskRow> = {}): PlannerTaskRow {
	return {
		id: 'task-1',
		memberId: 'member-1',
		weekStart: '2026-03-01',
		dayIndex: 0,
		title: 'Test task',
		completed: false,
		sortOrder: 0,
		status: 'active' as const,
		cancelledAt: null,
		rescheduleCount: 0,
		rescheduleHistory: null,
		rescheduledFromId: null,
		memberName: 'Alice',
		memberTheme: {
			variant: 'default',
			accent: '#4a7c59',
			accentLight: '#dcfce7',
			accentDark: '#1e3a24',
			headerBg: '#4a7c59',
			ringColor: '#4a7c59',
			checkColor: '#4a7c59',
			emoji: ''
		},
		...overrides
	};
}

// ── Tests ──────────────────────────────────────────────

describe('GetFamilyTasks', () => {
	let repo: ReturnType<typeof makeMockRepo>;
	let useCase: GetFamilyTasks;

	beforeEach(() => {
		repo = makeMockRepo();
		useCase = new GetFamilyTasks(repo);
	});

	it('returns family tasks for a week', () => {
		const tasks = [
			makePlannerTaskRow({ id: 'task-1', dayIndex: 0 }),
			makePlannerTaskRow({ id: 'task-2', dayIndex: 1, memberName: 'Bob' })
		];
		vi.mocked(repo.findFamilyWeek).mockReturnValue(tasks);

		const result = useCase.execute('2026-03-01');

		expect(result).toEqual(tasks);
		expect(repo.findFamilyWeek).toHaveBeenCalledWith('2026-03-01');
	});

	it('returns empty array when no tasks exist', () => {
		vi.mocked(repo.findFamilyWeek).mockReturnValue([]);

		const result = useCase.execute('2026-03-01');

		expect(result).toEqual([]);
	});

	it('throws ValidationError when weekStart is empty', () => {
		expect(() => useCase.execute('')).toThrow(ValidationError);
		expect(() => useCase.execute('')).toThrow('week parameter is required');
	});

	it('does not call repository when validation fails', () => {
		try {
			useCase.execute('');
		} catch {
			// expected
		}

		expect(repo.findFamilyWeek).not.toHaveBeenCalled();
	});
});
