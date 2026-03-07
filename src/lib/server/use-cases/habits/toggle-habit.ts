import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { NotFoundError, ValidationError } from '$lib/server/domain/errors';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class ToggleHabit {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(id: string, weekStart: string, dayIndex: number): { completed: boolean } {
		if (!weekStart?.trim()) throw new ValidationError('weekStart is required');
		if (dayIndex === undefined || dayIndex < 0 || dayIndex > 6) {
			throw new ValidationError('dayIndex must be 0-6');
		}

		const habit = this.habitRepo.findById(id);
		if (!habit) throw new NotFoundError('Habit', id);

		const exists = this.habitRepo.findCompletion(id, weekStart, dayIndex);
		if (exists) {
			this.habitRepo.deleteCompletion(id, weekStart, dayIndex);
			return { completed: false };
		} else {
			this.habitRepo.insertCompletion(id, weekStart, dayIndex);
			return { completed: true };
		}
	}
}

export const toggleHabit = new ToggleHabit(habitRepository);
