import type { TaskRepository, PlannerTaskRow } from '$lib/server/repositories/task-repository';
import { ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';

export class GetFamilyTasks {
	constructor(private taskRepo: TaskRepository) {}

	execute(weekStart: string): PlannerTaskRow[] {
		if (!weekStart) throw new ValidationError('week parameter is required');
		return this.taskRepo.findFamilyWeek(weekStart);
	}
}

export const getFamilyTasks = new GetFamilyTasks(taskRepository);
