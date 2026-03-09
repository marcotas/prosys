import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export interface DeleteTaskResult {
	id: string;
	memberId: string | null;
	weekStart: string;
	dayIndex: number;
	cancelledInstead?: boolean;
	task?: TaskData;
}

export class DeleteTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string): DeleteTaskResult {
		const existing = this.taskRepo.findById(id);
		if (!existing) throw new NotFoundError('Task', id);

		if (existing.isPast(new Date())) {
			throw new ValidationError('Cannot delete past tasks; use cancel instead');
		}

		// Reschedule protection: cancel instead of delete for rescheduled copies
		if (existing.rescheduleCount > 0) {
			// Use updatePartial since cancel() validates isPast which doesn't apply here
			const cancelledData: TaskData = {
				...existing.toJSON(),
				status: 'cancelled',
				cancelledAt: new Date().toISOString()
			};
			this.taskRepo.update(cancelledData);
			return {
				id,
				memberId: existing.memberId,
				weekStart: existing.weekStart,
				dayIndex: existing.dayIndex,
				cancelledInstead: true,
				task: cancelledData
			};
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
