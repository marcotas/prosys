import { Habit } from '$lib/domain/habit';
import type { CreateHabitInput, HabitData } from '$lib/domain/types';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { habitRepository } from '$lib/server/repositories/habit-repository';
import { ValidationError } from '$lib/server/domain/errors';

export class CreateHabit {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(input: CreateHabitInput): HabitData {
		let habit: Habit;
		try {
			habit = Habit.create(input);
		} catch (err) {
			throw new ValidationError((err as Error).message);
		}
		const sortOrder = this.habitRepo.getNextSortOrder(input.memberId);
		habit.setSortOrder(sortOrder);
		const data = habit.toJSON();
		this.habitRepo.insert(data);
		return data;
	}
}

export const createHabit = new CreateHabit(habitRepository);
