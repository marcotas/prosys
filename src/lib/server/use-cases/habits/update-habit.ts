import type { HabitData } from '$lib/domain/types';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { NotFoundError } from '$lib/server/domain/errors';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class UpdateHabit {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(id: string, input: { name?: string; emoji?: string }): HabitData {
		const existing = this.habitRepo.findById(id);
		if (!existing) throw new NotFoundError('Habit', id);

		this.habitRepo.updatePartial(id, input);
		return this.habitRepo.findById(id)!;
	}
}

export const updateHabit = new UpdateHabit(habitRepository);
