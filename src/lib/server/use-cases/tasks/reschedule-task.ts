import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { NotFoundError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export interface RescheduleResult {
	original: TaskData;
	newTask: TaskData;
}

export class RescheduleTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string, toWeekStart: string, toDayIndex: number): RescheduleResult {
		const task = this.taskRepo.findById(id);
		if (!task) throw new NotFoundError('Task', id);

		const newTask = task.reschedule(new Date(), toWeekStart, toDayIndex);

		this.taskRepo.update(task.toJSON());

		const sortOrder = this.taskRepo.getNextSortOrder(task.memberId, toWeekStart, toDayIndex);
		newTask.setSortOrder(sortOrder);
		this.taskRepo.insert(newTask.toJSON());

		return { original: task.toJSON(), newTask: newTask.toJSON() };
	}
}

export const rescheduleTask = new RescheduleTask(taskRepository);
