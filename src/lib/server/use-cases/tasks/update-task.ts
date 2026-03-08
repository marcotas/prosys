import type { UpdateTaskInput, TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { NotFoundError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export interface UpdateTaskResult {
	task: TaskData;
	isMoved: boolean;
	fromDay: number;
	fromWeek: string;
}

export class UpdateTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string, input: UpdateTaskInput): UpdateTaskResult {
		const task = this.taskRepo.findById(id);
		if (!task) throw new NotFoundError('Task', id);

		const isMoved = task.isMove(input);
		const fromDay = task.dayIndex;
		const fromWeek = task.weekStart;

		this.taskRepo.updatePartial(id, input);
		const updated = this.taskRepo.findById(id)!;

		return { task: updated.toJSON(), isMoved, fromDay, fromWeek };
	}
}

export const updateTask = new UpdateTask(taskRepository);
