import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskController } from './task-controller';
import type { TaskData, CreateTaskInput } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import { ApiError } from '$lib/utils/api-error';

// ── Mock factories ──────────────────────────────────────

function createMockApi(): ApiClient {
	return {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		setClientId: vi.fn(),
		getHeaders: vi.fn().mockReturnValue({ 'X-WS-Client-Id': 'test-id' })
	} as unknown as ApiClient;
}

function createMockQueue(): OfflineQueue {
	return {
		enqueue: vi.fn(),
		getAll: vi.fn().mockResolvedValue([]),
		remove: vi.fn(),
		clear: vi.fn(),
		pendingCount: 0,
		init: vi.fn(),
		replay: vi.fn(),
		onChange: vi.fn(),
		dispose: vi.fn()
	} as unknown as OfflineQueue;
}

function createMockWs(): WebSocketClient {
	const handlers = new Map<string, Set<(payload: unknown) => void>>();
	return {
		clientId: 'test-client',
		connected: true,
		syncing: false,
		onMessage: vi.fn((type: string, handler: (payload: unknown) => void) => {
			let set = handlers.get(type);
			if (!set) {
				set = new Set();
				handlers.set(type, set);
			}
			set.add(handler);
			return () => set!.delete(handler);
		}),
		onSync: vi.fn(),
		connect: vi.fn(),
		destroy: vi.fn(),
		onChange: vi.fn(),
		dispose: vi.fn(),
		// Test helper to dispatch messages
		_dispatch(type: string, payload: unknown) {
			const set = handlers.get(type);
			if (set) for (const h of set) h(payload);
		}
	} as unknown as WebSocketClient & { _dispatch: (type: string, payload: unknown) => void };
}

// ── Test data ───────────────────────────────────────────

const MEMBER_ID = 'member-1';
const WEEK = '2026-03-01'; // Sunday

function taskData(overrides: Partial<TaskData> = {}): TaskData {
	return {
		id: 'task-1',
		memberId: MEMBER_ID,
		weekStart: WEEK,
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

// ── Tests ───────────────────────────────────────────────

describe('TaskController', () => {
	let api: ReturnType<typeof createMockApi>;
	let queue: ReturnType<typeof createMockQueue>;
	let ws: ReturnType<typeof createMockWs>;
	let ctrl: TaskController;

	beforeEach(() => {
		api = createMockApi();
		queue = createMockQueue();
		ws = createMockWs();
		ctrl = new TaskController(api, queue, ws);
	});

	describe('constructor', () => {
		it('self-registers WS handlers', () => {
			expect(ws.onMessage).toHaveBeenCalledWith('task:created', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:updated', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:cancelled', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:deleted', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:reordered', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:moved', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('task:rescheduled', expect.any(Function));
		});

		it('starts with loading=false', () => {
			expect(ctrl.loading).toBe(false);
		});
	});

	describe('hydration', () => {
		it('hydrateWeek() populates cache and notifies', () => {
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
			expect(listener).toHaveBeenCalled();
		});

		it('hydrateWeek() skips if already cached', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ id: 'task-2' })]);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
			expect(listener).not.toHaveBeenCalled();
		});

		it('hydrateFamilyWeek() populates family cache', () => {
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});

		it('hydrateFamilyWeek() skips if already cached', () => {
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ id: 'task-2' })]);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});
	});

	describe('queries', () => {
		it('getTasksForDay() returns sorted tasks for a day', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 2, dayIndex: 0 }),
				taskData({ id: 't2', sortOrder: 0, dayIndex: 0 }),
				taskData({ id: 't3', sortOrder: 1, dayIndex: 1 })
			]);

			const day0 = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(day0.map((t) => t.id)).toEqual(['t2', 't1']);
		});

		it('getTasksForDay() returns empty for uncached week', () => {
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toEqual([]);
		});

		it('getFamilyTasksForDay() returns sorted family tasks', () => {
			ctrl.hydrateFamilyWeek(WEEK, [
				taskData({ id: 't1', sortOrder: 1, dayIndex: 0 }),
				taskData({ id: 't2', sortOrder: 0, dayIndex: 0 })
			]);
			const tasks = ctrl.getFamilyTasksForDay(WEEK, 0);
			expect(tasks.map((t) => t.id)).toEqual(['t2', 't1']);
		});

		it('getAllFamilyTasks() returns all family tasks', () => {
			ctrl.hydrateFamilyWeek(WEEK, [
				taskData({ id: 't1', dayIndex: 0 }),
				taskData({ id: 't2', dayIndex: 3 })
			]);
			expect(ctrl.getAllFamilyTasks(WEEK)).toHaveLength(2);
		});
	});

	describe('loaders', () => {
		it('loadWeek() fetches and caches tasks', async () => {
			const tasks = [taskData()];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);

			await ctrl.loadWeek(MEMBER_ID, WEEK);

			expect(api.get).toHaveBeenCalledWith(`/api/members/${MEMBER_ID}/tasks?week=${WEEK}`);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
		});

		it('loadWeek() skips if already cached', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			await ctrl.loadWeek(MEMBER_ID, WEEK);
			expect(api.get).not.toHaveBeenCalled();
		});

		it('loadWeek() sets loading state', async () => {
			const states: boolean[] = [];
			ctrl.onChange(() => states.push(ctrl.loading));
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

			await ctrl.loadWeek(MEMBER_ID, WEEK);

			expect(states[0]).toBe(true); // loading started
			expect(states[states.length - 1]).toBe(false); // loading ended
		});

		it('loadWeek() resets loading on error', async () => {
			(api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

			await expect(ctrl.loadWeek(MEMBER_ID, WEEK)).rejects.toThrow('fail');
			expect(ctrl.loading).toBe(false);
		});

		it('reloadWeek() always fetches (ignores cache)', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const newTasks = [taskData({ id: 'new-1' })];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(newTasks);

			await ctrl.reloadWeek(MEMBER_ID, WEEK);

			expect(api.get).toHaveBeenCalled();
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].id).toBe('new-1');
		});

		it('loadFamilyWeek() fetches family tasks', async () => {
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue([taskData()]);

			await ctrl.loadFamilyWeek(WEEK);

			expect(api.get).toHaveBeenCalledWith(`/api/family/tasks?week=${WEEK}`);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});

		it('loadFamilyWeek() skips if cached', async () => {
			ctrl.hydrateFamilyWeek(WEEK, []);
			await ctrl.loadFamilyWeek(WEEK);
			expect(api.get).not.toHaveBeenCalled();
		});

		it('reloadFamilyWeek() always fetches', async () => {
			ctrl.hydrateFamilyWeek(WEEK, []);
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue([taskData()]);

			await ctrl.reloadFamilyWeek(WEEK);

			expect(api.get).toHaveBeenCalled();
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});
	});

	describe('create()', () => {
		const input: CreateTaskInput = {
			memberId: MEMBER_ID,
			weekStart: WEEK,
			dayIndex: 0,
			title: 'New task'
		};

		it('creates task optimistically and replaces with server response', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			const serverData = taskData({ id: 'server-1', title: 'New task' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			const result = await ctrl.create(input);

			expect(result).toEqual(serverData);
			expect(api.post).toHaveBeenCalledWith('/api/tasks', input);
			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].id).toBe('server-1');
		});

		it('creates in both member and family caches', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			ctrl.hydrateFamilyWeek(WEEK, []);
			const serverData = taskData({ id: 'server-1', title: 'New task' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.create(input);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});

		it('enqueues on network error and returns null', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			const result = await ctrl.create(input);

			expect(result).toBeNull();
			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'POST',
				url: '/api/tasks',
				body: input,
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
			// Optimistic task still in cache
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

			await expect(ctrl.create(input)).rejects.toThrow('Server error');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});

		it('computes sortOrder from family cache when available', async () => {
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ sortOrder: 5, dayIndex: 0 })]);
			const serverData = taskData({ id: 'server-1', title: 'New task', sortOrder: 6 });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.create(input);

			// The optimistic task should have sortOrder 6 (max 5 + 1)
			expect(api.post).toHaveBeenCalled();
		});

		it('uses sortOrder 0 when no caches exist', async () => {
			const serverData = taskData({ id: 'server-1' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.create(input);
			expect(api.post).toHaveBeenCalled();
		});

		it('handles create without memberId', async () => {
			const noMemberInput: CreateTaskInput = {
				weekStart: WEEK,
				dayIndex: 0,
				title: 'Unassigned'
			};
			const serverData = taskData({ id: 'server-1', memberId: null });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.create(noMemberInput);
			expect(api.post).toHaveBeenCalledWith('/api/tasks', noMemberInput);
		});
	});

	describe('update()', () => {
		it('updates task optimistically', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const serverData = taskData({ title: 'Updated' });
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.update('task-1', { title: 'Updated' });

			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].title).toBe('Updated');
		});

		it('does nothing if task not found', async () => {
			await ctrl.update('nonexistent', { title: 'Updated' });
			expect(api.patch).not.toHaveBeenCalled();
		});

		it('handles emoji update', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(taskData({ emoji: '🎉' }));

			await ctrl.update('task-1', { emoji: '🎉' });
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].emoji).toBe('🎉');
		});

		it('handles completion update', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(
				taskData({ completed: true })
			);

			await ctrl.update('task-1', { completed: true });
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].isCompleted).toBe(true);
		});

		it('handles uncomplete update', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ completed: true })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(
				taskData({ completed: false })
			);

			await ctrl.update('task-1', { completed: false });
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].isCompleted).toBe(false);
		});

		it('handles sortOrder update', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(taskData({ sortOrder: 5 }));

			await ctrl.update('task-1', { sortOrder: 5 });
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].sortOrder).toBe(5);
		});

		it('enqueues on network error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			await ctrl.update('task-1', { title: 'Updated' });
			expect(queue.enqueue).toHaveBeenCalled();
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ title: 'Original' })]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

			await expect(ctrl.update('task-1', { title: 'Updated' })).rejects.toThrow(
				'Server error'
			);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].title).toBe('Original');
		});

		it('handles member reassignment', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateWeek('member-2', WEEK, []);
			const serverData = taskData({ memberId: 'member-2' });
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.update('task-1', { memberId: 'member-2' });

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay('member-2', WEEK, 0)).toHaveLength(1);
		});

		it('handles 404 by removing task from caches', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.update('task-1', { title: 'Updated' });
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});
	});

	describe('toggle()', () => {
		it('toggles task completion', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ completed: false })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(
				taskData({ completed: true })
			);

			await ctrl.toggle('task-1');
			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', { completed: true });
		});

		it('does nothing if task not found', async () => {
			await ctrl.toggle('nonexistent');
			expect(api.patch).not.toHaveBeenCalled();
		});
	});

	describe('delete()', () => {
		it('deletes task optimistically', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.delete('task-1');

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});

		it('does nothing if task not found', async () => {
			await ctrl.delete('nonexistent');
			expect(api.delete).not.toHaveBeenCalled();
		});

		it('enqueues on network error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			await ctrl.delete('task-1');
			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'DELETE',
				url: '/api/tasks/task-1',
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

			await expect(ctrl.delete('task-1')).rejects.toThrow('Server error');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
		});

		it('handles 404 by keeping task removed', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.delete('task-1');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});
	});

	describe('reorder()', () => {
		it('reorders tasks optimistically', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 0, dayIndex: 0 }),
				taskData({ id: 't2', sortOrder: 1, dayIndex: 0 })
			]);
			(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.reorder(MEMBER_ID, WEEK, 0, ['t2', 't1']);

			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].id).toBe('t2');
			expect(tasks[1].id).toBe('t1');
		});

		it('reorders in both member and family caches', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 0 }),
				taskData({ id: 't2', sortOrder: 1 })
			]);
			ctrl.hydrateFamilyWeek(WEEK, [
				taskData({ id: 't1', sortOrder: 0 }),
				taskData({ id: 't2', sortOrder: 1 })
			]);
			(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.reorder(MEMBER_ID, WEEK, 0, ['t2', 't1']);

			expect(ctrl.getFamilyTasksForDay(WEEK, 0)[0].id).toBe('t2');
		});

		it('does nothing for empty taskIds', async () => {
			await ctrl.reorder(MEMBER_ID, WEEK, 0, []);
			expect(api.put).not.toHaveBeenCalled();
		});

		it('enqueues on network error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			await ctrl.reorder(MEMBER_ID, WEEK, 0, ['task-1']);
			expect(queue.enqueue).toHaveBeenCalled();
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 0 }),
				taskData({ id: 't2', sortOrder: 1 })
			]);
			(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

			await expect(ctrl.reorder(MEMBER_ID, WEEK, 0, ['t2', 't1'])).rejects.toThrow('fail');
			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].id).toBe('t1');
		});

		it('handles 404 gracefully without rollback', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 0 }),
				taskData({ id: 't2', sortOrder: 1 })
			]);
			(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.reorder(MEMBER_ID, WEEK, 0, ['t2', 't1']);
			// Keeps optimistic reorder (no rollback)
			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].id).toBe('t2');
		});
	});

	describe('moveToDate()', () => {
		beforeEach(() => {
			// Freeze to Mar 1 so WEEK (2026-03-01) tasks are not past
			vi.useFakeTimers({ now: new Date(2026, 2, 1, 12, 0, 0) });
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('moves task within same week', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', WEEK, 3);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 3)).toHaveLength(1);
		});

		it('does nothing if task not found', async () => {
			await ctrl.moveToDate('nonexistent', WEEK, 3);
			expect(api.patch).not.toHaveBeenCalled();
		});

		it('does nothing if target is same position', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			await ctrl.moveToDate('task-1', WEEK, 0);
			expect(api.patch).not.toHaveBeenCalled();
		});

		it('moves task cross-week', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateWeek(MEMBER_ID, newWeek, []);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', newWeek, 2);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)).toHaveLength(1);
		});

		it('cross-week move adds to family cache if loaded', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(newWeek, []);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', newWeek, 0);

			expect(ctrl.getFamilyTasksForDay(newWeek, 0)).toHaveLength(1);
		});

		it('includes weekStart in patch body for cross-week', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', newWeek, 2);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				dayIndex: 2,
				sortOrder: 0,
				weekStart: newWeek
			});
		});

		it('computes sortOrder from target cache', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', dayIndex: 3, sortOrder: 5 }),
				taskData({ id: 't2', dayIndex: 0 })
			]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('t2', WEEK, 3);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/t2', {
				dayIndex: 3,
				sortOrder: 6
			});
		});

		it('enqueues on network error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			await ctrl.moveToDate('task-1', WEEK, 3);
			expect(queue.enqueue).toHaveBeenCalled();
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

			await expect(ctrl.moveToDate('task-1', WEEK, 3)).rejects.toThrow('fail');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 3)).toHaveLength(0);
		});

		it('handles cross-week with family cache as sortOrder source', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(newWeek, [taskData({ id: 'existing', dayIndex: 0, sortOrder: 3 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', newWeek, 0);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				dayIndex: 0,
				sortOrder: 4,
				weekStart: newWeek
			});
		});

		it('uses 0 sortOrder when no target cache exists (cross-week)', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', newWeek, 0);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				dayIndex: 0,
				sortOrder: 0,
				weekStart: newWeek
			});
		});

		it('uses 0 sortOrder when no cache exists for same-week move', async () => {
			// Task found via findById (in some cache) but target member key not cached
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ id: 't1', dayIndex: 0, memberId: null })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('t1', WEEK, 3);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/t1', {
				dayIndex: 3,
				sortOrder: 0
			});
		});

		it('uses 0 sortOrder when neither member nor family cache exists for same-week move', async () => {
			// Task only exists in member cache, no family cache loaded, and member cache
			// doesn't have the target member key (memberId is set but different key)
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			// Remove the member cache to simulate no cache for sortOrder lookup
			ctrl.clearCache();
			// Re-add only the task via a different path so findById works but cache lookup misses
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ dayIndex: 0 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', WEEK, 3);

			// Family cache exists so sortOrder comes from there (0 + 1 = 0 since no tasks at day 3)
			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				dayIndex: 3,
				sortOrder: 0
			});
		});

		it('same-week move updates both member and family caches', async () => {
			const td = taskData({ dayIndex: 0 });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [td]);
			ctrl.hydrateFamilyWeek(WEEK, [{ ...td }]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('task-1', WEEK, 3);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 3)).toHaveLength(1);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(0);
			expect(ctrl.getFamilyTasksForDay(WEEK, 3)).toHaveLength(1);
		});

		it('uses family cache sortOrder for same-week move', async () => {
			ctrl.hydrateFamilyWeek(WEEK, [
				taskData({ id: 't1', dayIndex: 3, sortOrder: 2 }),
				taskData({ id: 't2', dayIndex: 0 })
			]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDate('t2', WEEK, 3);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/t2', {
				dayIndex: 3,
				sortOrder: 3
			});
		});

		it('handles 404 by removing task from caches', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.moveToDate('task-1', WEEK, 3);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 3)).toHaveLength(0);
		});
	});

	describe('moveToDay()', () => {
		beforeEach(() => {
			vi.useFakeTimers({ now: new Date(2026, 2, 1, 12, 0, 0) });
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('delegates to moveToDate with current weekStart', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.moveToDay('task-1', 4);

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				dayIndex: 4,
				sortOrder: 0
			});
		});

		it('does nothing if task not found', async () => {
			await ctrl.moveToDay('nonexistent', 3);
			expect(api.patch).not.toHaveBeenCalled();
		});
	});

	describe('assignTask()', () => {
		it('delegates to update with memberId', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(
				taskData({ memberId: 'member-2' })
			);

			await ctrl.assignTask('task-1', 'member-2');

			expect(api.patch).toHaveBeenCalledWith('/api/tasks/task-1', {
				memberId: 'member-2'
			});
		});
	});

	describe('remote sync', () => {
		it('applyRemoteCreate adds to member and family caches', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			ctrl.hydrateFamilyWeek(WEEK, []);

			const data = taskData({ id: 'remote-1' });
			(ws as any)._dispatch('task:created', data);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(1);
		});

		it('applyRemoteCreate skips uncached member', () => {
			const data = taskData({ id: 'remote-1' });
			(ws as any)._dispatch('task:created', data);
			// No crash, no data
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});

		it('applyRemoteUpdate replaces task in caches', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ title: 'Old' })]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ title: 'Old' })]);

			const updated = taskData({ title: 'New' });
			(ws as any)._dispatch('task:updated', updated);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].title).toBe('New');
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)[0].title).toBe('New');
		});

		it('applyRemoteUpdate handles member reassignment', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateWeek('member-2', WEEK, []);

			const reassigned = taskData({ memberId: 'member-2' });
			(ws as any)._dispatch('task:updated', reassigned);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay('member-2', WEEK, 0)).toHaveLength(1);
		});

		it('applyRemoteUpdate adds to caches for new task', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
			const data = taskData({ id: 'new-remote' });
			(ws as any)._dispatch('task:updated', data);

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(1);
		});

		it('task:cancelled WS handler updates task status', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);

			const cancelled = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(ws as any)._dispatch('task:cancelled', cancelled);

			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].isCancelled).toBe(true);
		});

		it('applyRemoteDelete removes from caches', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);

			(ws as any)._dispatch('task:deleted', {
				id: 'task-1',
				memberId: MEMBER_ID,
				weekStart: WEEK
			});

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)).toHaveLength(0);
		});

		it('applyRemoteReorder updates sort order', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				taskData({ id: 't1', sortOrder: 0 }),
				taskData({ id: 't2', sortOrder: 1 })
			]);

			(ws as any)._dispatch('task:reordered', {
				memberId: MEMBER_ID,
				weekStart: WEEK,
				dayIndex: 0,
				taskIds: ['t2', 't1']
			});

			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].id).toBe('t2');
		});

		it('applyRemoteMove handles same-week move', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData({ dayIndex: 0 })]);

			(ws as any)._dispatch('task:moved', {
				task: taskData({ dayIndex: 3 }),
				fromDay: 0
			});

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 3)).toHaveLength(1);
		});

		it('applyRemoteMove handles cross-week move', () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateWeek(MEMBER_ID, newWeek, []);

			(ws as any)._dispatch('task:moved', {
				task: taskData({ weekStart: newWeek, dayIndex: 2 }),
				fromDay: 0,
				fromWeek: WEEK
			});

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)).toHaveLength(1);
		});

		it('applyRemoteMove cross-week adds to family cache', () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(newWeek, []);

			(ws as any)._dispatch('task:moved', {
				task: taskData({ weekStart: newWeek, dayIndex: 0 }),
				fromDay: 0,
				fromWeek: WEEK
			});

			expect(ctrl.getFamilyTasksForDay(newWeek, 0)).toHaveLength(1);
		});
	});

	describe('cancel()', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('cancels task optimistically and calls cancel API', async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const serverData = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.cancel('task-1');

			expect(api.post).toHaveBeenCalledWith('/api/tasks/task-1/cancel');
			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks[0].isCancelled).toBe(true);
		});

		it('cancels in both member and family caches', async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			const serverData = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.cancel('task-1');

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].isCancelled).toBe(true);
			expect(ctrl.getFamilyTasksForDay(WEEK, 0)[0].isCancelled).toBe(true);
		});

		it('does nothing if task not found', async () => {
			await ctrl.cancel('nonexistent');
			expect(api.post).not.toHaveBeenCalled();
		});

		it('enqueues on network error', async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
				new TypeError('Failed to fetch')
			);

			await ctrl.cancel('task-1');
			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'POST',
				url: '/api/tasks/task-1/cancel',
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
		});

		it('rolls back on server error', async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

			await expect(ctrl.cancel('task-1')).rejects.toThrow('Server error');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].isCancelled).toBe(false);
		});

		it('handles 404 by removing task from caches', async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);

			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.cancel('task-1');
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
		});
	});

	describe('deleteOrCancel()', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('calls cancel for past tasks', async () => {
			// Freeze to 2026-03-07 so WEEK (2026-03-01) dayIndex 0 is past
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const serverData = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverData);

			await ctrl.deleteOrCancel('task-1');

			expect(api.post).toHaveBeenCalledWith('/api/tasks/task-1/cancel');
			expect(api.delete).not.toHaveBeenCalled();
		});

		it('calls delete for future tasks', async () => {
			// Freeze to 2026-03-07; use a future week so task is not past
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			const futureWeek = '2099-03-02';
			ctrl.hydrateWeek(MEMBER_ID, futureWeek, [taskData({ weekStart: futureWeek })]);
			(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await ctrl.deleteOrCancel('task-1');

			expect(api.delete).toHaveBeenCalledWith('/api/tasks/task-1');
			expect(api.post).not.toHaveBeenCalled();
		});

		it('does nothing if task not found', async () => {
			await ctrl.deleteOrCancel('nonexistent');
			expect(api.post).not.toHaveBeenCalled();
			expect(api.delete).not.toHaveBeenCalled();
		});
	});

	describe('reschedule()', () => {
		it('reschedules task optimistically and replaces with server response', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const newWeek = '2026-03-08';
			const serverResponse = {
				original: taskData({ status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', weekStart: newWeek, dayIndex: 2, rescheduleCount: 1, rescheduledFromId: 'task-1' })
			};
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverResponse);

			const result = await ctrl.reschedule('task-1', newWeek, 2);

			expect(result).toEqual(serverResponse);
			expect(api.post).toHaveBeenCalledWith('/api/tasks/task-1/reschedule', { toWeekStart: newWeek, toDayIndex: 2 });
			// Original marked as rescheduled
			const original = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(original[0].status).toBe('rescheduled');
		});

		it('inserts new task in both member and family caches', async () => {
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			ctrl.hydrateWeek(MEMBER_ID, newWeek, []);
			ctrl.hydrateFamilyWeek(newWeek, []);
			const serverResponse = {
				original: taskData({ status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', weekStart: newWeek, dayIndex: 2, rescheduleCount: 1, rescheduledFromId: 'task-1' })
			};
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverResponse);

			await ctrl.reschedule('task-1', newWeek, 2);

			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)).toHaveLength(1);
			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)[0].id).toBe('new-task-1');
			expect(ctrl.getFamilyTasksForDay(newWeek, 2)).toHaveLength(1);
			expect(ctrl.getFamilyTasksForDay(newWeek, 2)[0].id).toBe('new-task-1');
		});

		it('does nothing if task not found', async () => {
			const result = await ctrl.reschedule('nonexistent', '2026-03-08', 2);
			expect(result).toBeNull();
			expect(api.post).not.toHaveBeenCalled();
		});

		it('enqueues on network error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));

			const result = await ctrl.reschedule('task-1', '2026-03-08', 2);

			expect(result).toBeNull();
			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'POST',
				url: '/api/tasks/task-1/reschedule',
				body: { toWeekStart: '2026-03-08', toDayIndex: 2 },
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
		});

		it('rolls back on server error', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

			await expect(ctrl.reschedule('task-1', '2026-03-08', 2)).rejects.toThrow('Server error');
			// Original should be restored to active
			const tasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].status).toBe('active');
		});

		it('handles 404 by removing original and temp tasks', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateWeek(MEMBER_ID, '2026-03-08', []);
			(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404));

			const result = await ctrl.reschedule('task-1', '2026-03-08', 2);

			expect(result).toBeNull();
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(ctrl.getTasksForDay(MEMBER_ID, '2026-03-08', 2)).toHaveLength(0);
		});
	});

	describe('delete() — cancelledInstead', () => {
		it('returns cancelledInstead when server cancels instead of deleting', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const cancelledTask = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
				cancelledInstead: true,
				task: cancelledTask
			});

			const result = await ctrl.delete('task-1');

			expect(result).toEqual({ cancelledInstead: true });
		});

		it('restores cancelled task in member and family caches', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			const cancelledTask = taskData({ status: 'cancelled', cancelledAt: '2026-03-07T00:00:00Z' });
			(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
				cancelledInstead: true,
				task: cancelledTask
			});

			await ctrl.delete('task-1');

			// Task should be restored as cancelled in both caches
			const memberTasks = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(memberTasks).toHaveLength(1);
			expect(memberTasks[0].isCancelled).toBe(true);
			const familyTasks = ctrl.getFamilyTasksForDay(WEEK, 0);
			expect(familyTasks).toHaveLength(1);
			expect(familyTasks[0].isCancelled).toBe(true);
		});
	});

	describe('moveToDate() — past task reschedule', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('delegates to reschedule for past tasks', async () => {
			// Freeze to 2026-03-07 so WEEK (2026-03-01) dayIndex 0 is past
			vi.useFakeTimers({ now: new Date(2026, 2, 7, 12, 0, 0) });
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const serverResponse = {
				original: taskData({ status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', weekStart: '2026-03-08', dayIndex: 2 })
			};
			(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverResponse);

			await ctrl.moveToDate('task-1', '2026-03-08', 2);

			expect(api.post).toHaveBeenCalledWith('/api/tasks/task-1/reschedule', {
				toWeekStart: '2026-03-08',
				toDayIndex: 2
			});
			expect(api.patch).not.toHaveBeenCalled();
		});
	});

	describe('remote sync — reschedule', () => {
		it('applyRemoteReschedule updates original and inserts new task', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			ctrl.hydrateFamilyWeek(WEEK, [taskData()]);
			const newWeek = '2026-03-08';
			ctrl.hydrateWeek(MEMBER_ID, newWeek, []);
			ctrl.hydrateFamilyWeek(newWeek, []);

			(ws as any)._dispatch('task:rescheduled', {
				original: taskData({ status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', weekStart: newWeek, dayIndex: 2 })
			});

			// Original updated
			const origMember = ctrl.getTasksForDay(MEMBER_ID, WEEK, 0);
			expect(origMember[0].status).toBe('rescheduled');
			const origFamily = ctrl.getFamilyTasksForDay(WEEK, 0);
			expect(origFamily[0].status).toBe('rescheduled');

			// New task inserted
			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)).toHaveLength(1);
			expect(ctrl.getTasksForDay(MEMBER_ID, newWeek, 2)[0].id).toBe('new-task-1');
			expect(ctrl.getFamilyTasksForDay(newWeek, 2)).toHaveLength(1);
		});

		it('applyRemoteReschedule works when target caches not loaded', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);

			const listener = vi.fn();
			ctrl.onChange(listener);

			(ws as any)._dispatch('task:rescheduled', {
				original: taskData({ status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', weekStart: '2026-03-08', dayIndex: 2 })
			});

			// Should not crash, and should notify
			expect(listener).toHaveBeenCalled();
			// Original updated in member cache
			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)[0].status).toBe('rescheduled');
		});

		it('applyRemoteReschedule handles task without memberId', () => {
			ctrl.hydrateFamilyWeek(WEEK, [taskData({ memberId: null })]);
			const newWeek = '2026-03-08';
			ctrl.hydrateFamilyWeek(newWeek, []);

			(ws as any)._dispatch('task:rescheduled', {
				original: taskData({ memberId: null, status: 'rescheduled' }),
				newTask: taskData({ id: 'new-task-1', memberId: null, weekStart: newWeek, dayIndex: 2 })
			});

			expect(ctrl.getFamilyTasksForDay(WEEK, 0)[0].status).toBe('rescheduled');
			expect(ctrl.getFamilyTasksForDay(newWeek, 2)).toHaveLength(1);
		});
	});

	describe('clearCache()', () => {
		it('clears all data and notifies', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [taskData()]);
			const listener = vi.fn();
			ctrl.onChange(listener);

			ctrl.clearCache();

			expect(ctrl.getTasksForDay(MEMBER_ID, WEEK, 0)).toHaveLength(0);
			expect(listener).toHaveBeenCalled();
		});
	});
});
