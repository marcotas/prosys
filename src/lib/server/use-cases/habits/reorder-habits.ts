import { ValidationError } from '$lib/server/domain/errors';
import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class ReorderHabits {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(input: { memberId: string; habitIds: string[] }): void {
		const { memberId, habitIds } = input;

		if (!memberId?.trim()) throw new ValidationError('memberId is required');
		if (!Array.isArray(habitIds) || habitIds.length === 0) {
			throw new ValidationError('habitIds must be a non-empty array');
		}

		const existingIds = new Set(this.habitRepo.findIdsByMember(memberId));
		for (const id of habitIds) {
			if (!existingIds.has(id)) {
				throw new ValidationError(`Habit ${id} not found for this member`);
			}
		}

		this.habitRepo.reorder(habitIds, new Date().toISOString());
	}
}

export const reorderHabits = new ReorderHabits(habitRepository);
