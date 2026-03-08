import type { TaskData, CreateTaskInput, UpdateTaskInput } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import { ChangeNotifier } from '$lib/domain/change-notifier';
import { Task } from '$lib/domain/task';
import { TaskCollection } from '$lib/domain/task-collection';
import { optimisticAction } from '$lib/infra/optimistic-action';
import { isTaskPast } from '$lib/utils/dates';

const FAMILY_KEY_PREFIX = '__family__';

function cacheKey(memberId: string, weekStart: string): string {
	return `${memberId}:${weekStart}`;
}

function familyKey(weekStart: string): string {
	return `${FAMILY_KEY_PREFIX}:${weekStart}`;
}

export class TaskController extends ChangeNotifier {
	private tasks = new TaskCollection();
	private _loading = false;

	constructor(
		private api: ApiClient,
		private offlineQueue: OfflineQueue,
		ws: WebSocketClient
	) {
		super();
		ws.onMessage('task:created', (p: TaskData) => this.applyRemoteCreate(p));
		ws.onMessage('task:updated', (p: TaskData) => this.applyRemoteUpdate(p));
		ws.onMessage('task:cancelled', (p: TaskData) => this.applyRemoteUpdate(p));
		ws.onMessage('task:deleted', (p: { id: string; memberId: string | null; weekStart: string }) =>
			this.applyRemoteDelete(p)
		);
		ws.onMessage(
			'task:reordered',
			(p: { memberId: string | null; weekStart: string; dayIndex: number; taskIds: string[] }) =>
				this.applyRemoteReorder(p)
		);
		ws.onMessage(
			'task:moved',
			(p: { task: TaskData; fromDay: number; fromWeek?: string }) => this.applyRemoteMove(p)
		);
	}

	get loading(): boolean {
		return this._loading;
	}

	// ── Hydration (from SSR) ────────────────────────────────

	hydrateWeek(memberId: string, weekStart: string, tasks: TaskData[]): void {
		const key = cacheKey(memberId, weekStart);
		if (this.tasks.has(key)) return;
		this.tasks.hydrate(
			key,
			tasks.map((t) => Task.fromData(t))
		);
		this.notifyChanges();
	}

	hydrateFamilyWeek(weekStart: string, tasks: TaskData[]): void {
		const key = familyKey(weekStart);
		if (this.tasks.has(key)) return;
		this.tasks.hydrate(
			key,
			tasks.map((t) => Task.fromData(t))
		);
		this.notifyChanges();
	}

	// ── Queries ─────────────────────────────────────────────

	getTasksForDay(memberId: string, weekStart: string, dayIndex: number): Task[] {
		return this.tasks.getForDay(cacheKey(memberId, weekStart), dayIndex);
	}

	getFamilyTasksForDay(weekStart: string, dayIndex: number): Task[] {
		return this.tasks.getForDay(familyKey(weekStart), dayIndex);
	}

	getAllFamilyTasks(weekStart: string): Task[] {
		return this.tasks.getAll(familyKey(weekStart));
	}

	// ── Loaders ─────────────────────────────────────────────

	async loadWeek(memberId: string, weekStart: string): Promise<void> {
		const key = cacheKey(memberId, weekStart);
		if (this.tasks.has(key)) return;
		await this.fetchWeek(key, `/api/members/${memberId}/tasks?week=${weekStart}`);
	}

	async reloadWeek(memberId: string, weekStart: string): Promise<void> {
		const key = cacheKey(memberId, weekStart);
		await this.fetchWeek(key, `/api/members/${memberId}/tasks?week=${weekStart}`);
	}

	async loadFamilyWeek(weekStart: string): Promise<void> {
		const key = familyKey(weekStart);
		if (this.tasks.has(key)) return;
		await this.fetchWeek(key, `/api/family/tasks?week=${weekStart}`);
	}

	async reloadFamilyWeek(weekStart: string): Promise<void> {
		const key = familyKey(weekStart);
		await this.fetchWeek(key, `/api/family/tasks?week=${weekStart}`);
	}

	private async fetchWeek(key: string, url: string): Promise<void> {
		this._loading = true;
		this.notifyChanges();
		try {
			const data = await this.api.get<TaskData[]>(url);
			this.tasks.hydrate(
				key,
				data.map((t) => Task.fromData(t))
			);
		} finally {
			this._loading = false;
			this.notifyChanges();
		}
	}

	// ── Mutations ───────────────────────────────────────────

	async create(input: CreateTaskInput): Promise<TaskData | null> {
		const memberId = input.memberId ?? null;
		const mKey = memberId ? cacheKey(memberId, input.weekStart) : null;
		const fKey = familyKey(input.weekStart);

		// Compute sortOrder from available caches
		const dayIndex = input.dayIndex;
		let sortOrder: number;
		if (this.tasks.has(fKey)) {
			sortOrder = this.tasks.nextSortOrder(fKey, dayIndex);
		} else if (mKey && this.tasks.has(mKey)) {
			sortOrder = this.tasks.nextSortOrder(mKey, dayIndex);
		} else {
			sortOrder = 0;
		}

		const task = Task.fromData({
			id: `temp-${Date.now()}`,
			memberId,
			weekStart: input.weekStart,
			dayIndex,
			title: input.title,
			emoji: input.emoji,
			completed: false,
			sortOrder,
			status: 'active' as const,
			cancelledAt: null
		});

		return optimisticAction<TaskData>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					if (mKey) this.tasks.insert(mKey, task);
					if (this.tasks.has(fKey)) this.tasks.insert(fKey, task.clone());
				},
				request: () => this.api.post<TaskData>('/api/tasks', input),
				onSuccess: (data) => {
					// Replace temp task with server response in all caches
					this.removeFromAll(task.id);
					const serverTask = Task.fromData(data);
					if (mKey && this.tasks.has(mKey)) this.tasks.insert(mKey, serverTask);
					if (this.tasks.has(fKey)) this.tasks.insert(fKey, serverTask.clone());
				},
				offlinePayload: { method: 'POST', url: '/api/tasks', body: input, headers: this.api.getHeaders() }
			}
		);
	}

	async update(id: string, data: UpdateTaskInput): Promise<void> {
		const task = this.tasks.findById(id);
		if (!task) return;

		await optimisticAction<TaskData>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					// Update all clones (member + family caches)
					for (const t of this.tasks.findAllById(id)) {
						if (data.title !== undefined) t.updateTitle(data.title);
						if (data.emoji !== undefined) t.updateEmoji(data.emoji);
						if (data.completed !== undefined) {
							if (data.completed) t.complete(); else t.uncomplete();
						}
						if (data.sortOrder !== undefined) t.setSortOrder(data.sortOrder);
					}
					if (data.memberId !== undefined) {
						const oldMemberId = task.memberId;
						task.assignTo(data.memberId);
						this.handleMemberChange(task, oldMemberId);
					}
				},
				request: () => this.api.patch<TaskData>(`/api/tasks/${id}`, data),
				onSuccess: (serverData) => this.replaceTask(id, serverData),
				offlinePayload: { method: 'PATCH', url: `/api/tasks/${id}`, body: data, headers: this.api.getHeaders() }
			}
		);
	}

	async toggle(id: string): Promise<void> {
		const task = this.tasks.findById(id);
		if (!task) return;
		return this.update(id, { completed: !task.isCompleted });
	}

	async delete(id: string): Promise<void> {
		const task = this.tasks.findById(id);
		if (!task) return;

		await optimisticAction<void>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					this.removeFromAll(id);
				},
				request: () => this.api.delete<void>(`/api/tasks/${id}`),
				onSuccess: () => {},
				offlinePayload: { method: 'DELETE', url: `/api/tasks/${id}`, headers: this.api.getHeaders() }
			}
		);
	}

	async cancel(id: string): Promise<void> {
		const task = this.tasks.findById(id);
		if (!task) return;

		await optimisticAction<TaskData>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					for (const t of this.tasks.findAllById(id)) {
						t.cancel();
					}
				},
				request: () => this.api.post<TaskData>(`/api/tasks/${id}/cancel`),
				onSuccess: (data) => this.replaceTask(id, data),
				offlinePayload: { method: 'POST', url: `/api/tasks/${id}/cancel`, headers: this.api.getHeaders() }
			}
		);
	}

	async deleteOrCancel(id: string): Promise<void> {
		const task = this.tasks.findById(id);
		if (!task) return;

		if (isTaskPast(task.weekStart, task.dayIndex)) {
			return this.cancel(id);
		}
		return this.delete(id);
	}

	async reorder(
		memberId: string | null,
		weekStart: string,
		dayIndex: number,
		taskIds: string[]
	): Promise<void> {
		if (taskIds.length === 0) return;

		const mKey = memberId ? cacheKey(memberId, weekStart) : null;
		const fKey = familyKey(weekStart);

		await optimisticAction<void>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					if (mKey) this.tasks.reorder(mKey, dayIndex, taskIds);
					this.tasks.reorder(fKey, dayIndex, taskIds);
				},
				request: () =>
					this.api.put<void>('/api/tasks/reorder', {
						memberId,
						weekStart,
						dayIndex,
						taskIds
					}),
				onSuccess: () => {},
				offlinePayload: {
					method: 'PUT',
					url: '/api/tasks/reorder',
					body: { memberId, weekStart, dayIndex, taskIds },
					headers: this.api.getHeaders()
				}
			}
		);
	}

	async moveToDate(taskId: string, toWeekStart: string, toDayIndex: number): Promise<void> {
		const task = this.tasks.findById(taskId);
		if (!task) return;
		if (task.dayIndex === toDayIndex && task.weekStart === toWeekStart) return;

		const isCrossWeek = task.weekStart !== toWeekStart;
		const memberId = task.memberId;

		// Compute target sortOrder
		let sortOrder: number;
		if (isCrossWeek) {
			const targetMKey = memberId ? cacheKey(memberId, toWeekStart) : null;
			const targetFKey = familyKey(toWeekStart);
			if (targetMKey && this.tasks.has(targetMKey)) {
				sortOrder = this.tasks.nextSortOrder(targetMKey, toDayIndex);
			} else if (this.tasks.has(targetFKey)) {
				sortOrder = this.tasks.nextSortOrder(targetFKey, toDayIndex);
			} else {
				sortOrder = 0;
			}
		} else {
			const mKey = memberId ? cacheKey(memberId, task.weekStart) : null;
			const fKey = familyKey(task.weekStart);
			if (mKey && this.tasks.has(mKey)) {
				sortOrder = this.tasks.nextSortOrder(mKey, toDayIndex);
			} else if (this.tasks.has(fKey)) {
				sortOrder = this.tasks.nextSortOrder(fKey, toDayIndex);
			} else {
				sortOrder = 0;
			}
		}

		const patchBody: Record<string, unknown> = { dayIndex: toDayIndex, sortOrder };
		if (isCrossWeek) patchBody.weekStart = toWeekStart;

		await optimisticAction<void>(
			this.tasks,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					if (isCrossWeek) {
						// Remove from old caches, add to new
						this.removeFromAll(taskId);
						const moved = Task.fromData({
							...task.toJSON(),
							weekStart: toWeekStart,
							dayIndex: toDayIndex,
							sortOrder
						});
						if (memberId) {
							const targetMKey = cacheKey(memberId, toWeekStart);
							if (this.tasks.has(targetMKey)) this.tasks.insert(targetMKey, moved);
						}
						const targetFKey = familyKey(toWeekStart);
						if (this.tasks.has(targetFKey)) this.tasks.insert(targetFKey, moved.clone());
					} else {
						// Must update in ALL caches (member + family) since they hold separate clones
						for (const t of this.tasks.findAllById(taskId)) {
							t.setDay(toDayIndex, t.weekStart, sortOrder);
						}
					}
				},
				request: () => this.api.patch<void>(`/api/tasks/${taskId}`, patchBody),
				onSuccess: () => {},
				offlinePayload: {
					method: 'PATCH',
					url: `/api/tasks/${taskId}`,
					body: patchBody,
					headers: this.api.getHeaders()
				}
			}
		);
	}

	async moveToDay(taskId: string, toDayIndex: number): Promise<void> {
		const task = this.tasks.findById(taskId);
		if (!task) return;
		return this.moveToDate(taskId, task.weekStart, toDayIndex);
	}

	async assignTask(taskId: string, memberId: string | null): Promise<void> {
		return this.update(taskId, { memberId });
	}

	// ── Remote sync ─────────────────────────────────────────

	applyRemoteCreate(data: TaskData): void {
		const task = Task.fromData(data);
		if (task.memberId) {
			const mKey = cacheKey(task.memberId, task.weekStart);
			if (this.tasks.has(mKey)) this.tasks.insert(mKey, task);
		}
		const fKey = familyKey(task.weekStart);
		if (this.tasks.has(fKey)) this.tasks.insert(fKey, task.clone());
		this.notifyChanges();
	}

	applyRemoteUpdate(data: TaskData): void {
		const serverTask = Task.fromData(data);
		const existing = this.tasks.findById(data.id);

		if (existing) {
			// Remove from all caches first (handles member reassignment)
			this.removeFromAll(data.id);
		}

		// Insert into correct caches
		if (serverTask.memberId) {
			const mKey = cacheKey(serverTask.memberId, serverTask.weekStart);
			if (this.tasks.has(mKey)) this.tasks.insert(mKey, serverTask);
		}
		const fKey = familyKey(serverTask.weekStart);
		if (this.tasks.has(fKey)) this.tasks.insert(fKey, serverTask.clone());

		this.notifyChanges();
	}

	applyRemoteDelete(payload: { id: string; memberId: string | null; weekStart: string }): void {
		this.removeFromAll(payload.id);
		this.notifyChanges();
	}

	applyRemoteReorder(payload: {
		memberId: string | null;
		weekStart: string;
		dayIndex: number;
		taskIds: string[];
	}): void {
		if (payload.memberId) {
			this.tasks.reorder(
				cacheKey(payload.memberId, payload.weekStart),
				payload.dayIndex,
				payload.taskIds
			);
		}
		this.tasks.reorder(familyKey(payload.weekStart), payload.dayIndex, payload.taskIds);
		this.notifyChanges();
	}

	applyRemoteMove(payload: { task: TaskData; fromDay: number; fromWeek?: string }): void {
		const task = Task.fromData(payload.task);

		// Remove from all caches (old week + family)
		this.removeFromAll(task.id);

		// Re-insert into correct caches for current week
		if (task.memberId) {
			const mKey = cacheKey(task.memberId, task.weekStart);
			if (this.tasks.has(mKey)) this.tasks.insert(mKey, task);
		}
		const fKey = familyKey(task.weekStart);
		if (this.tasks.has(fKey)) this.tasks.insert(fKey, task.clone());

		this.notifyChanges();
	}

	// ── Cache ───────────────────────────────────────────────

	clearCache(): void {
		this.tasks.clear();
		this.notifyChanges();
	}

	// ── Private helpers ─────────────────────────────────────

	/** Remove a task by id from ALL caches (member + family). */
	private removeFromAll(taskId: string): void {
		while (this.tasks.remove(taskId)) {
			// keep removing until no more copies found
		}
	}

	private replaceTask(id: string, data: TaskData): void {
		this.removeFromAll(id);
		const serverTask = Task.fromData(data);
		if (serverTask.memberId) {
			const mKey = cacheKey(serverTask.memberId, serverTask.weekStart);
			if (this.tasks.has(mKey)) this.tasks.insert(mKey, serverTask);
		}
		const fKey = familyKey(serverTask.weekStart);
		if (this.tasks.has(fKey)) this.tasks.insert(fKey, serverTask.clone());
	}

	private handleMemberChange(task: Task, oldMemberId: string | null): void {
		if (oldMemberId === task.memberId) return;
		// Remove from all caches and re-insert into correct ones
		this.removeFromAll(task.id);
		if (task.memberId) {
			const newKey = cacheKey(task.memberId, task.weekStart);
			if (this.tasks.has(newKey)) this.tasks.insert(newKey, task);
		}
		const fKey = familyKey(task.weekStart);
		if (this.tasks.has(fKey)) this.tasks.insert(fKey, task.clone());
	}
}
