import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export interface DeleteTaskResult {
	id: string;
	memberId: string | null;
	weekStart: string;
	dayIndex: number;
}

export class DeleteTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string): DeleteTaskResult {
		const existing = this.taskRepo.findById(id);
		if (!existing) throw new NotFoundError('Task', id);

		if (existing.isPast) {
			throw new ValidationError('Cannot delete past tasks; use cancel instead');
		}

		this.taskRepo.delete(id);

		return {
			id,
			memberId: existing.memberId,
			weekStart: existing.weekStart,
			dayIndex: existing.dayIndex
		};
	}
}

export const deleteTask = new DeleteTask(taskRepository);
