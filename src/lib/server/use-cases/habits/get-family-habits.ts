import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import type { FamilyHabitProgress } from '$lib/types';
import { ValidationError } from '$lib/server/domain/errors';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class GetFamilyHabits {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(weekStart: string): FamilyHabitProgress[] {
		if (!weekStart) throw new ValidationError('week parameter is required');
		return this.habitRepo.findFamilyWithCompletions(weekStart);
	}
}

export const getFamilyHabits = new GetFamilyHabits(habitRepository);
