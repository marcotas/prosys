import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { NotFoundError } from '$lib/server/domain/errors';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class DeleteHabit {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(id: string): { id: string; memberId: string } {
		const existing = this.habitRepo.findById(id);
		if (!existing) throw new NotFoundError('Habit', id);

		this.habitRepo.delete(id);
		return { id, memberId: existing.memberId };
	}
}

export const deleteHabit = new DeleteHabit(habitRepository);
