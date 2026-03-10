import type { Habit, HabitData } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import type { HabitWithDays, FamilyHabitProgress } from '$lib/types';
import { ChangeNotifier } from '$lib/domain/change-notifier';
import { HabitWeekCache } from '$lib/domain/habit-week-cache';
import { optimisticAction } from '$lib/infra/optimistic-action';

export class HabitController extends ChangeNotifier {
	private cache = new HabitWeekCache();
	private _loading = false;

	constructor(
		private api: ApiClient,
		private offlineQueue: OfflineQueue,
		ws: WebSocketClient
	) {
		super();
		ws.onMessage('habit:created', (p: Habit) => this.applyRemoteCreate(p));
		ws.onMessage('habit:updated', (p: Habit) => this.applyRemoteUpdate(p));
		ws.onMessage('habit:deleted', (p: { id: string; memberId: string }) =>
			this.applyRemoteDelete(p)
		);
		ws.onMessage(
			'habit:toggled',
			(p: { habitId: string; weekStart: string; dayIndex: number; completed: boolean }) =>
				this.applyRemoteToggle(p)
		);
		ws.onMessage('habit:reordered', (p: { memberId: string; habitIds: string[] }) =>
			this.applyRemoteReorder(p)
		);
	}

	// ── Getters ──────────────────────────────────────────────

	get loading(): boolean {
		return this._loading;
	}

	// ── Hydration (from SSR) ─────────────────────────────────

	hydrateWeek(memberId: string, weekStart: string, habits: HabitWithDays[]): void {
		const key = HabitWeekCache.memberKey(memberId, weekStart);
		if (this.cache.has(key)) return;
		this.cache.hydrate(key, habits);
		this.notifyChanges();
	}

	hydrateFamilyWeek(weekStart: string, data: FamilyHabitProgress[]): void {
		const key = HabitWeekCache.familyKey(weekStart);
		if (this.cache.has(key)) return;
		this.cache.hydrate(key, data);
		this.notifyChanges();
	}

	// ── Queries ──────────────────────────────────────────────

	getHabitsWithDays(memberId: string, weekStart: string): HabitWithDays[] {
		return this.cache.getHabitsWithDays(HabitWeekCache.memberKey(memberId, weekStart));
	}

	getFamilyHabitProgress(weekStart: string): FamilyHabitProgress[] {
		return this.cache.getFamilyHabitProgress(HabitWeekCache.familyKey(weekStart));
	}

	// ── Loaders ──────────────────────────────────────────────

	async loadWeek(memberId: string, weekStart: string): Promise<void> {
		const key = HabitWeekCache.memberKey(memberId, weekStart);
		if (this.cache.has(key)) return;
		await this.fetchAndCache(key, `/api/members/${memberId}/habits?week=${weekStart}`);
	}

	async reloadWeek(memberId: string, weekStart: string): Promise<void> {
		const key = HabitWeekCache.memberKey(memberId, weekStart);
		await this.fetchAndCache(key, `/api/members/${memberId}/habits?week=${weekStart}`);
	}

	async loadFamilyWeek(weekStart: string): Promise<void> {
		const key = HabitWeekCache.familyKey(weekStart);
		if (this.cache.has(key)) return;
		await this.fetchAndCache(key, `/api/family/habits?week=${weekStart}`);
	}

	async reloadFamilyWeek(weekStart: string): Promise<void> {
		const key = HabitWeekCache.familyKey(weekStart);
		await this.fetchAndCache(key, `/api/family/habits?week=${weekStart}`);
	}

	private async fetchAndCache<T extends HabitWithDays[] | FamilyHabitProgress[]>(
		key: string,
		url: string
	): Promise<void> {
		this._loading = true;
		this.notifyChanges();
		try {
			const data = await this.api.get<T>(url);
			this.cache.hydrate(key, data);
		} finally {
			this._loading = false;
			this.notifyChanges();
		}
	}

	// ── Mutations ────────────────────────────────────────────

	async create(memberId: string, name: string, emoji?: string, weekStart?: string): Promise<HabitData | null> {
		// Compute sortOrder from any cached week for this member
		let sortOrder = 0;
		for (const [, habits] of this.cache.memberEntries(memberId)) {
			sortOrder = Math.max(sortOrder, habits.length);
		}

		const tempId = `temp-${Date.now()}`;
		const tempHabit: HabitWithDays = {
			id: tempId,
			memberId,
			name,
			emoji,
			sortOrder,
			days: [false, false, false, false, false, false, false]
		};

		return optimisticAction<HabitData>(this.cache, this.offlineQueue, () => this.notifyChanges(), {
			apply: () => {
				this.cache.insertHabit(memberId, tempHabit, weekStart);
				this.cache.invalidateFamilyCaches();
			},
			request: () => this.api.post<HabitData>('/api/habits', { memberId, name, emoji }),
			onSuccess: (created) => {
				this.cache.replaceTemp(memberId, tempId, {
					...created,
					days: [false, false, false, false, false, false, false]
				});
			},
			offlinePayload: {
				method: 'POST',
				url: '/api/habits',
				body: { memberId, name, emoji },
				headers: this.api.getHeaders()
			}
		});
	}

	async update(id: string, data: { name?: string; emoji?: string }): Promise<void> {
		await optimisticAction<HabitData>(this.cache, this.offlineQueue, () => this.notifyChanges(), {
			apply: () => {
				this.cache.updateHabit(id, data);
				this.cache.invalidateFamilyCaches();
			},
			request: () => this.api.patch<HabitData>(`/api/habits/${id}`, data),
			onSuccess: (updated) => {
				this.cache.updateHabit(id, updated);
			},
			offlinePayload: {
				method: 'PATCH',
				url: `/api/habits/${id}`,
				body: data,
				headers: this.api.getHeaders()
			},
			onNotFound: () => {
				this.cache.removeHabit(id);
				this.cache.invalidateFamilyCaches();
			}
		});
	}

	async delete(id: string): Promise<void> {
		await optimisticAction<void>(this.cache, this.offlineQueue, () => this.notifyChanges(), {
			apply: () => {
				this.cache.removeHabit(id);
				this.cache.invalidateFamilyCaches();
			},
			request: () => this.api.delete<void>(`/api/habits/${id}`),
			onSuccess: () => {},
			offlinePayload: {
				method: 'DELETE',
				url: `/api/habits/${id}`,
				headers: this.api.getHeaders()
			},
			onNotFound: () => {}
		});
	}

	async toggle(habitId: string, weekStart: string, dayIndex: number): Promise<void> {
		await optimisticAction<void>(this.cache, this.offlineQueue, () => this.notifyChanges(), {
			apply: () => {
				this.cache.toggleDay(habitId, weekStart, dayIndex);
			},
			request: () =>
				this.api.put<void>(`/api/habits/${habitId}/toggle`, { weekStart, dayIndex }),
			onSuccess: () => {},
			offlinePayload: {
				method: 'PUT',
				url: `/api/habits/${habitId}/toggle`,
				body: { weekStart, dayIndex },
				headers: this.api.getHeaders()
			}
		});
	}

	async reorder(memberId: string, habitIds: string[]): Promise<void> {
		await optimisticAction<void>(this.cache, this.offlineQueue, () => this.notifyChanges(), {
			apply: () => {
				this.cache.reorderHabits(memberId, habitIds);
				this.cache.invalidateFamilyCaches();
			},
			request: () => this.api.put<void>('/api/habits/reorder', { memberId, habitIds }),
			onSuccess: () => {},
			offlinePayload: {
				method: 'PUT',
				url: '/api/habits/reorder',
				body: { memberId, habitIds },
				headers: this.api.getHeaders()
			}
		});
	}

	// ── Remote sync ──────────────────────────────────────────

	applyRemoteCreate(habit: Habit): void {
		const habitWithDays: HabitWithDays = {
			...habit,
			days: [false, false, false, false, false, false, false]
		};
		this.cache.insertHabit(habit.memberId, habitWithDays);
		this.cache.invalidateFamilyCaches();
		this.notifyChanges();
	}

	applyRemoteUpdate(habit: Habit): void {
		this.cache.updateHabit(habit.id, habit);
		this.cache.invalidateFamilyCaches();
		this.notifyChanges();
	}

	applyRemoteDelete(payload: { id: string; memberId: string }): void {
		this.cache.removeHabit(payload.id);
		this.cache.invalidateFamilyCaches();
		this.notifyChanges();
	}

	applyRemoteToggle(payload: {
		habitId: string;
		weekStart: string;
		dayIndex: number;
		completed: boolean;
	}): void {
		this.cache.setDay(payload.habitId, payload.weekStart, payload.dayIndex, payload.completed);
		this.notifyChanges();
	}

	applyRemoteReorder(payload: { memberId: string; habitIds: string[] }): void {
		this.cache.reorderHabits(payload.memberId, payload.habitIds);
		this.cache.invalidateFamilyCaches();
		this.notifyChanges();
	}

	// ── Cache ────────────────────────────────────────────────

	clearCache(): void {
		this.cache.clear();
		this.notifyChanges();
	}

}
