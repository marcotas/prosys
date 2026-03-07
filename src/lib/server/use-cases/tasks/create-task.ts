import type { CreateTaskInput, TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
import { ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export class CreateTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(input: CreateTaskInput): TaskData {
		let task: Task;
		try {
			task = Task.create(input);
		} catch (err) {
			throw new ValidationError((err as Error).message);
		}

		const sortOrder = this.taskRepo.getNextSortOrder(
			input.memberId ?? null,
			input.weekStart,
			input.dayIndex
		);
		task.setSortOrder(sortOrder);

		const data = task.toJSON();
		this.taskRepo.insert(data);
		return data;
	}
}

export const createTask = new CreateTask(taskRepository);
