import type { UpdateTaskInput, TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
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
		const existing = this.taskRepo.findById(id);
		if (!existing) throw new NotFoundError('Task', id);

		const entity = Task.fromData(existing);
		const isMoved = entity.isMove(input);
		const fromDay = existing.dayIndex;
		const fromWeek = existing.weekStart;

		this.taskRepo.updatePartial(id, input);
		const updated = this.taskRepo.findById(id)!;

		return { task: updated, isMoved, fromDay, fromWeek };
	}
}

export const updateTask = new UpdateTask(taskRepository);
