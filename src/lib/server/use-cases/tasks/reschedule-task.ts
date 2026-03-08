import type { TaskData } from '$lib/domain/types';
import type { TaskRepository } from '$lib/server/repositories/task-repository';
import { Task } from '$lib/domain/task';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';
import { taskRepository } from '$lib/server/repositories/task-repository';
import { isoToDate } from '$lib/utils/dates';

export interface RescheduleResult {
	original: TaskData;
	newTask: TaskData;
}

export class RescheduleTask {
	constructor(private taskRepo: TaskRepository) {}

	execute(id: string, toWeekStart: string, toDayIndex: number): RescheduleResult {
		const task = this.taskRepo.findById(id);
		if (!task) throw new NotFoundError('Task', id);

		const today = new Date();

		// Input validation: target must be today or future (before mutating entity)
		const targetDate = isoToDate(toWeekStart);
		targetDate.setDate(targetDate.getDate() + toDayIndex);
		const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		if (targetDate.getTime() < todayMidnight.getTime()) {
			throw new ValidationError('Target date must be today or in the future');
		}

		// Entity validates: must be past + active
		task.reschedule(today);

		// Persist original as rescheduled
		this.taskRepo.update(task.toJSON());

		// Build reschedule history
		const originalDate = isoToDate(task.weekStart);
		originalDate.setDate(originalDate.getDate() + task.dayIndex);
		const dateStr = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, '0')}-${String(originalDate.getDate()).padStart(2, '0')}`;

		const prevHistory = task.rescheduleHistory ?? [];
		const newCount = task.rescheduleCount + 1;
		const updatedHistory = [...prevHistory, { date: dateStr, count: newCount }];

		// Create new task via domain factory
		const newTask = Task.create({
			title: task.title,
			emoji: task.emoji,
			memberId: task.memberId ?? undefined,
			weekStart: toWeekStart,
			dayIndex: toDayIndex
		});

		const sortOrder = this.taskRepo.getNextSortOrder(task.memberId, toWeekStart, toDayIndex);
		newTask.setSortOrder(sortOrder);
		newTask.setRescheduleInfo(newCount, updatedHistory, task.id);

		this.taskRepo.insert(newTask.toJSON());

		return {
			original: task.toJSON(),
			newTask: newTask.toJSON()
		};
	}
}

export const rescheduleTask = new RescheduleTask(taskRepository);
