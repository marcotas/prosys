import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { NotFoundError, ValidationError, ConflictError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export class CancelTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string): TaskData {
		const task = this.taskRepo.findById(id);
		if (!task) throw new NotFoundError('Task', id);

		if (!task.isPast) {
			throw new ValidationError('Only past tasks can be cancelled');
		}

		if (task.isCancelled) {
			throw new ConflictError('Task is already cancelled');
		}

		task.cancel();
		this.taskRepo.update(task.toJSON());

		return task.toJSON();
	}
}

export const cancelTask = new CancelTask(taskRepository);
