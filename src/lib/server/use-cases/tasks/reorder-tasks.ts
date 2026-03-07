import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export interface ReorderTasksInput {
	memberId?: string | null;
	weekStart: string;
	dayIndex: number;
	taskIds: string[];
}

export class ReorderTasks {
	constructor(private taskRepo: TaskRepository) {}

	execute(input: ReorderTasksInput): void {
		const { weekStart, dayIndex, taskIds } = input;

		if (!weekStart?.trim()) throw new ValidationError('weekStart is required');
		if (dayIndex === undefined || dayIndex < 0 || dayIndex > 6)
			throw new ValidationError('dayIndex must be 0-6');
		if (!Array.isArray(taskIds) || taskIds.length === 0)
			throw new ValidationError('taskIds must be a non-empty array');

		const resolvedMemberId =
			typeof input.memberId === 'string' ? input.memberId.trim() || null : null;

		const existingIds = new Set(
			this.taskRepo.findIdsByDay(resolvedMemberId, weekStart, dayIndex)
		);
		for (const id of taskIds) {
			if (!existingIds.has(id))
				throw new ValidationError(`Task ${id} not found in this day`);
		}

		this.taskRepo.reorder(taskIds, new Date().toISOString());
	}
}

export const reorderTasks = new ReorderTasks(taskRepository);
