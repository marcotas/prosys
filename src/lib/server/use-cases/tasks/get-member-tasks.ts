import type { TaskData } from '$lib/domain/types';
import { ValidationError } from '$lib/server/domain/errors';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { taskRepository } from '$lib/server/repositories/task-repository';

export class GetMemberTasks {
	constructor(private taskRepo: TaskRepository) {}

	execute(memberId: string, weekStart: string): TaskData[] {
		if (!weekStart) throw new ValidationError('Missing week parameter');
		return this.taskRepo.findByMemberAndWeek(memberId, weekStart);
	}
}

export const getMemberTasks = new GetMemberTasks(taskRepository);
