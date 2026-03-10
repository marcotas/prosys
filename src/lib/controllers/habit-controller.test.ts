import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HabitController } from './habit-controller';
import type { Habit, HabitData } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import type { HabitWithDays, FamilyHabitProgress } from '$lib/types';
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

function createMockWs(): WebSocketClient & {
	_dispatch: (type: string, payload: unknown) => void;
} {
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
		_dispatch(type: string, payload: unknown) {
			const set = handlers.get(type);
			if (set) for (const h of set) h(payload);
		}
	} as unknown as WebSocketClient & { _dispatch: (type: string, payload: unknown) => void };
}

// ── Test data ───────────────────────────────────────────

const MEMBER_ID = 'member-1';
const WEEK = '2026-03-01';

function habitData(overrides: Partial<HabitWithDays> = {}): HabitWithDays {
	return {
		id: 'habit-1',
		memberId: MEMBER_ID,
		name: 'Exercise',
		sortOrder: 0,
		days: [false, false, false, false, false, false, false],
		...overrides
	};
}

function familyProgress(overrides: Partial<FamilyHabitProgress> = {}): FamilyHabitProgress {
	return {
		memberId: MEMBER_ID,
		memberName: 'Alice',
		theme: {
			variant: 'default',
			accent: '#4a7c59',
			accentLight: '#dcfce7',
			accentDark: '#1e3a24',
			headerBg: '#4a7c59',
			ringColor: '#4a7c59',
			checkColor: '#4a7c59',
			emoji: ''
		},
		habits: [habitData()],
		...overrides
	};
}

// ── Tests ───────────────────────────────────────────────

describe('HabitController', () => {
	let api: ReturnType<typeof createMockApi>;
	let queue: ReturnType<typeof createMockQueue>;
	let ws: ReturnType<typeof createMockWs>;
	let ctrl: HabitController;

	beforeEach(() => {
		api = createMockApi();
		queue = createMockQueue();
		ws = createMockWs();
		ctrl = new HabitController(api, queue, ws);
	});

	describe('constructor', () => {
		it('self-registers 5 WS handlers', () => {
			expect(ws.onMessage).toHaveBeenCalledWith('habit:created', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('habit:updated', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('habit:deleted', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('habit:toggled', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('habit:reordered', expect.any(Function));
		});

		it('starts with loading=false', () => {
			expect(ctrl.loading).toBe(false);
		});
	});

	describe('hydration', () => {
		it('hydrateWeek() populates cache and notifies', () => {
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
			expect(listener).toHaveBeenCalled();
		});

		it('hydrateWeek() skips if already cached', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData({ id: 'habit-2' })]);

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].id).toBe('habit-1');
			expect(listener).not.toHaveBeenCalled();
		});

		it('hydrateFamilyWeek() populates family cache and notifies', () => {
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);

			expect(ctrl.getFamilyHabitProgress(WEEK)).toHaveLength(1);
			expect(listener).toHaveBeenCalled();
		});

		it('hydrateFamilyWeek() skips if already cached', () => {
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress({ memberId: 'member-2' })]);

			expect(ctrl.getFamilyHabitProgress(WEEK)).toHaveLength(1);
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('queries', () => {
		it('getHabitsWithDays() returns habits for a member week', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				habitData({ id: 'h1', sortOrder: 0 }),
				habitData({ id: 'h2', sortOrder: 1 })
			]);
			const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
			expect(habits).toHaveLength(2);
			expect(habits[0].id).toBe('h1');
		});

		it('getHabitsWithDays() returns empty for uncached week', () => {
			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toEqual([]);
		});

		it('getFamilyHabitProgress() returns family data', () => {
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
			const progress = ctrl.getFamilyHabitProgress(WEEK);
			expect(progress).toHaveLength(1);
			expect(progress[0].memberName).toBe('Alice');
		});

		it('getFamilyHabitProgress() returns empty for uncached week', () => {
			expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
		});
	});

	describe('loaders', () => {
		it('loadWeek() fetches and caches habits', async () => {
			const habits = [habitData()];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(habits);

			await ctrl.loadWeek(MEMBER_ID, WEEK);

			expect(api.get).toHaveBeenCalledWith(`/api/members/${MEMBER_ID}/habits?week=${WEEK}`);
			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
		});

		it('loadWeek() skips if already cached', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
			await ctrl.loadWeek(MEMBER_ID, WEEK);
			expect(api.get).not.toHaveBeenCalled();
		});

		it('loadWeek() sets loading state', async () => {
			const states: boolean[] = [];
			ctrl.onChange(() => states.push(ctrl.loading));
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

			await ctrl.loadWeek(MEMBER_ID, WEEK);

			expect(states[0]).toBe(true);
			expect(states[states.length - 1]).toBe(false);
		});

		it('loadWeek() resets loading on error', async () => {
			(api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

			await expect(ctrl.loadWeek(MEMBER_ID, WEEK)).rejects.toThrow('fail');
			expect(ctrl.loading).toBe(false);
		});

		it('reloadWeek() always fetches (bypasses cache)', async () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
			const newHabits = [habitData({ id: 'h-new' })];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(newHabits);

			await ctrl.reloadWeek(MEMBER_ID, WEEK);

			expect(api.get).toHaveBeenCalled();
			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].id).toBe('h-new');
		});

		it('loadFamilyWeek() fetches and caches family habits', async () => {
			const data = [familyProgress()];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(data);

			await ctrl.loadFamilyWeek(WEEK);

			expect(api.get).toHaveBeenCalledWith(`/api/family/habits?week=${WEEK}`);
			expect(ctrl.getFamilyHabitProgress(WEEK)).toHaveLength(1);
		});

		it('loadFamilyWeek() skips if already cached', async () => {
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
			await ctrl.loadFamilyWeek(WEEK);
			expect(api.get).not.toHaveBeenCalled();
		});

		it('reloadFamilyWeek() always fetches', async () => {
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
			const newData = [familyProgress({ memberName: 'Bob' })];
			(api.get as ReturnType<typeof vi.fn>).mockResolvedValue(newData);

			await ctrl.reloadFamilyWeek(WEEK);

			expect(api.get).toHaveBeenCalled();
			expect(ctrl.getFamilyHabitProgress(WEEK)[0].memberName).toBe('Bob');
		});
	});

	describe('mutations', () => {
		describe('create()', () => {
			it('optimistically inserts habit and calls API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				const serverHabit: HabitData = {
					id: 'server-1',
					memberId: MEMBER_ID,
					name: 'Read',
					sortOrder: 0
				};
				(api.post as ReturnType<typeof vi.fn>).mockResolvedValue(serverHabit);

				const result = await ctrl.create(MEMBER_ID, 'Read');

				expect(api.post).toHaveBeenCalledWith('/api/habits', {
					memberId: MEMBER_ID,
					name: 'Read',
					emoji: undefined
				});
				expect(result).toEqual(serverHabit);
				// Temp ID replaced with server ID
				const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
				expect(habits).toHaveLength(1);
				expect(habits[0].id).toBe('server-1');
			});

			it('passes emoji to API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
					id: 's-1',
					memberId: MEMBER_ID,
					name: 'Read',
					emoji: '📚',
					sortOrder: 0
				});

				await ctrl.create(MEMBER_ID, 'Read', '📚');

				expect(api.post).toHaveBeenCalledWith('/api/habits', {
					memberId: MEMBER_ID,
					name: 'Read',
					emoji: '📚'
				});
			});

			it('computes sortOrder from existing cached habits', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ id: 'h1', sortOrder: 0 }),
					habitData({ id: 'h2', sortOrder: 1 })
				]);
				(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
					id: 's-1',
					memberId: MEMBER_ID,
					name: 'New',
					sortOrder: 2
				});

				await ctrl.create(MEMBER_ID, 'New');

				// During optimistic insert, the temp habit should have sortOrder=2
				// After server replaces, we just check it was inserted
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(3);
			});

			it('invalidates family caches on create', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress({ habits: [] })]);

				(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
					id: 's-1',
					memberId: MEMBER_ID,
					name: 'New',
					sortOrder: 0
				});

				await ctrl.create(MEMBER_ID, 'New');

				// Family cache was invalidated
				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});

			it('enqueues offline payload on network error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
					new TypeError('Failed to fetch')
				);

				const result = await ctrl.create(MEMBER_ID, 'Read');

				expect(result).toBeNull();
				expect(queue.enqueue).toHaveBeenCalledWith(
					expect.objectContaining({
						method: 'POST',
						url: '/api/habits',
						body: { memberId: MEMBER_ID, name: 'Read', emoji: undefined }
					})
				);
			});

			it('rolls back on server error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
					new ApiError('Server error', 500)
				);

				await expect(ctrl.create(MEMBER_ID, 'New')).rejects.toThrow('Server error');

				// Rolled back — only original habit remains
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].id).toBe('habit-1');
			});
		});

		describe('update()', () => {
			it('optimistically updates and calls API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				const updated: HabitData = {
					id: 'habit-1',
					memberId: MEMBER_ID,
					name: 'Updated Name',
					sortOrder: 0
				};
				(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

				await ctrl.update('habit-1', { name: 'Updated Name' });

				expect(api.patch).toHaveBeenCalledWith('/api/habits/habit-1', {
					name: 'Updated Name'
				});
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].name).toBe('Updated Name');
			});

			it('invalidates family caches on update', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
				(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
					id: 'habit-1',
					memberId: MEMBER_ID,
					name: 'Updated',
					sortOrder: 0
				});

				await ctrl.update('habit-1', { name: 'Updated' });

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});

			it('enqueues offline payload on network error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(
					new TypeError('Failed to fetch')
				);

				await ctrl.update('habit-1', { name: 'New' });

				expect(queue.enqueue).toHaveBeenCalledWith(
					expect.objectContaining({
						method: 'PATCH',
						url: '/api/habits/habit-1'
					})
				);
			});

			it('rolls back on server error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData({ name: 'Original' })]);
				(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(
					new ApiError('fail', 500)
				);

				await expect(ctrl.update('habit-1', { name: 'Changed' })).rejects.toThrow('fail');

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].name).toBe('Original');
			});
		});

		describe('delete()', () => {
			it('optimistically removes and calls API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.delete('habit-1');

				expect(api.delete).toHaveBeenCalledWith('/api/habits/habit-1');
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(0);
			});

			it('invalidates family caches on delete', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
				(api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.delete('habit-1');

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});

			it('enqueues offline payload on network error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
					new TypeError('Failed to fetch')
				);

				await ctrl.delete('habit-1');

				expect(queue.enqueue).toHaveBeenCalledWith(
					expect.objectContaining({
						method: 'DELETE',
						url: '/api/habits/habit-1'
					})
				);
			});

			it('rolls back on server error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
					new ApiError('fail', 500)
				);

				await expect(ctrl.delete('habit-1')).rejects.toThrow('fail');

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
			});
		});

		describe('toggle()', () => {
			it('optimistically toggles a day and calls API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.toggle('habit-1', WEEK, 2);

				expect(api.put).toHaveBeenCalledWith('/api/habits/habit-1/toggle', {
					weekStart: WEEK,
					dayIndex: 2
				});
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[2]).toBe(true);
			});

			it('toggles back on second call', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ days: [false, false, true, false, false, false, false] })
				]);
				(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.toggle('habit-1', WEEK, 2);

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[2]).toBe(false);
			});

			it('does NOT invalidate family caches (updates inline)', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
				(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.toggle('habit-1', WEEK, 0);

				// Family cache should still exist (not invalidated)
				expect(ctrl.getFamilyHabitProgress(WEEK)).toHaveLength(1);
				// And the toggle should be reflected in the family cache too
				expect(ctrl.getFamilyHabitProgress(WEEK)[0].habits[0].days[0]).toBe(true);
			});

			it('enqueues offline payload on network error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(
					new TypeError('Failed to fetch')
				);

				await ctrl.toggle('habit-1', WEEK, 0);

				expect(queue.enqueue).toHaveBeenCalledWith(
					expect.objectContaining({
						method: 'PUT',
						url: '/api/habits/habit-1/toggle',
						body: { weekStart: WEEK, dayIndex: 0 }
					})
				);
			});

			it('rolls back on server error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(
					new ApiError('fail', 500)
				);

				await expect(ctrl.toggle('habit-1', WEEK, 0)).rejects.toThrow('fail');

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[0]).toBe(false);
			});
		});

		describe('reorder()', () => {
			it('optimistically reorders and calls API', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ id: 'h1', sortOrder: 0 }),
					habitData({ id: 'h2', sortOrder: 1 }),
					habitData({ id: 'h3', sortOrder: 2 })
				]);
				(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.reorder(MEMBER_ID, ['h3', 'h1', 'h2']);

				expect(api.put).toHaveBeenCalledWith('/api/habits/reorder', {
					memberId: MEMBER_ID,
					habitIds: ['h3', 'h1', 'h2']
				});
				const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
				expect(habits.map((h) => h.id)).toEqual(['h3', 'h1', 'h2']);
			});

			it('invalidates family caches on reorder', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ id: 'h1', sortOrder: 0 }),
					habitData({ id: 'h2', sortOrder: 1 })
				]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
				(api.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

				await ctrl.reorder(MEMBER_ID, ['h2', 'h1']);

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});

			it('enqueues offline payload on network error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(
					new TypeError('Failed to fetch')
				);

				await ctrl.reorder(MEMBER_ID, ['habit-1']);

				expect(queue.enqueue).toHaveBeenCalledWith(
					expect.objectContaining({
						method: 'PUT',
						url: '/api/habits/reorder'
					})
				);
			});

			it('rolls back on server error', async () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ id: 'h1', sortOrder: 0 }),
					habitData({ id: 'h2', sortOrder: 1 })
				]);
				(api.put as ReturnType<typeof vi.fn>).mockRejectedValue(
					new ApiError('fail', 500)
				);

				await expect(ctrl.reorder(MEMBER_ID, ['h2', 'h1'])).rejects.toThrow('fail');

				const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
				expect(habits[0].id).toBe('h1');
				expect(habits[1].id).toBe('h2');
			});
		});
	});

	describe('remote sync', () => {
		describe('applyRemoteCreate()', () => {
			it('inserts habit into cached member weeks and notifies', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				const listener = vi.fn();
				ctrl.onChange(listener);

				const habit: Habit = {
					id: 'h-new',
					memberId: MEMBER_ID,
					name: 'New Habit',
					sortOrder: 0
				};
				ctrl.applyRemoteCreate(habit);

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].id).toBe('h-new');
				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days).toEqual([
					false,
					false,
					false,
					false,
					false,
					false,
					false
				]);
				expect(listener).toHaveBeenCalled();
			});

			it('invalidates family caches', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, []);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress({ habits: [] })]);

				ctrl.applyRemoteCreate({
					id: 'h-new',
					memberId: MEMBER_ID,
					name: 'New',
					sortOrder: 0
				});

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});
		});

		describe('applyRemoteUpdate()', () => {
			it('updates habit in cached member weeks and notifies', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				const listener = vi.fn();
				ctrl.onChange(listener);

				ctrl.applyRemoteUpdate({
					id: 'habit-1',
					memberId: MEMBER_ID,
					name: 'Updated Remotely',
					sortOrder: 0
				});

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].name).toBe('Updated Remotely');
				expect(listener).toHaveBeenCalled();
			});

			it('invalidates family caches', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);

				ctrl.applyRemoteUpdate({
					id: 'habit-1',
					memberId: MEMBER_ID,
					name: 'Updated',
					sortOrder: 0
				});

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});
		});

		describe('applyRemoteDelete()', () => {
			it('removes habit from cached member weeks and notifies', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				const listener = vi.fn();
				ctrl.onChange(listener);

				ctrl.applyRemoteDelete({ id: 'habit-1', memberId: MEMBER_ID });

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(0);
				expect(listener).toHaveBeenCalled();
			});

			it('invalidates family caches', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);

				ctrl.applyRemoteDelete({ id: 'habit-1', memberId: MEMBER_ID });

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});
		});

		describe('applyRemoteToggle()', () => {
			it('sets day value (not toggles) and notifies', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				const listener = vi.fn();
				ctrl.onChange(listener);

				ctrl.applyRemoteToggle({
					habitId: 'habit-1',
					weekStart: WEEK,
					dayIndex: 3,
					completed: true
				});

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[3]).toBe(true);
				expect(listener).toHaveBeenCalled();
			});

			it('sets to false when completed=false', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ days: [true, true, true, true, true, true, true] })
				]);

				ctrl.applyRemoteToggle({
					habitId: 'habit-1',
					weekStart: WEEK,
					dayIndex: 3,
					completed: false
				});

				expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[3]).toBe(false);
			});

			it('updates family cache inline (does not invalidate)', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);

				ctrl.applyRemoteToggle({
					habitId: 'habit-1',
					weekStart: WEEK,
					dayIndex: 0,
					completed: true
				});

				// Family cache still exists
				expect(ctrl.getFamilyHabitProgress(WEEK)).toHaveLength(1);
				// And value is updated inline
				expect(ctrl.getFamilyHabitProgress(WEEK)[0].habits[0].days[0]).toBe(true);
			});
		});

		describe('applyRemoteReorder()', () => {
			it('reorders habits and notifies', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [
					habitData({ id: 'h1', sortOrder: 0 }),
					habitData({ id: 'h2', sortOrder: 1 })
				]);
				const listener = vi.fn();
				ctrl.onChange(listener);

				ctrl.applyRemoteReorder({
					memberId: MEMBER_ID,
					habitIds: ['h2', 'h1']
				});

				const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
				expect(habits[0].id).toBe('h2');
				expect(habits[1].id).toBe('h1');
				expect(listener).toHaveBeenCalled();
			});

			it('invalidates family caches', () => {
				ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
				ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);

				ctrl.applyRemoteReorder({
					memberId: MEMBER_ID,
					habitIds: ['habit-1']
				});

				expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			});
		});
	});

	describe('WS dispatch integration', () => {
		it('habit:created dispatches to applyRemoteCreate', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, []);

			ws._dispatch('habit:created', {
				id: 'h-ws',
				memberId: MEMBER_ID,
				name: 'WS Habit',
				sortOrder: 0
			});

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(1);
		});

		it('habit:updated dispatches to applyRemoteUpdate', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);

			ws._dispatch('habit:updated', {
				id: 'habit-1',
				memberId: MEMBER_ID,
				name: 'WS Updated',
				sortOrder: 0
			});

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].name).toBe('WS Updated');
		});

		it('habit:deleted dispatches to applyRemoteDelete', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);

			ws._dispatch('habit:deleted', { id: 'habit-1', memberId: MEMBER_ID });

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toHaveLength(0);
		});

		it('habit:toggled dispatches to applyRemoteToggle', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);

			ws._dispatch('habit:toggled', {
				habitId: 'habit-1',
				weekStart: WEEK,
				dayIndex: 5,
				completed: true
			});

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)[0].days[5]).toBe(true);
		});

		it('habit:reordered dispatches to applyRemoteReorder', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [
				habitData({ id: 'h1', sortOrder: 0 }),
				habitData({ id: 'h2', sortOrder: 1 })
			]);

			ws._dispatch('habit:reordered', {
				memberId: MEMBER_ID,
				habitIds: ['h2', 'h1']
			});

			const habits = ctrl.getHabitsWithDays(MEMBER_ID, WEEK);
			expect(habits[0].id).toBe('h2');
		});
	});

	describe('clearCache()', () => {
		it('clears all cached data and notifies', () => {
			ctrl.hydrateWeek(MEMBER_ID, WEEK, [habitData()]);
			ctrl.hydrateFamilyWeek(WEEK, [familyProgress()]);
			const listener = vi.fn();
			ctrl.onChange(listener);

			ctrl.clearCache();

			expect(ctrl.getHabitsWithDays(MEMBER_ID, WEEK)).toEqual([]);
			expect(ctrl.getFamilyHabitProgress(WEEK)).toEqual([]);
			expect(listener).toHaveBeenCalled();
		});
	});
});
