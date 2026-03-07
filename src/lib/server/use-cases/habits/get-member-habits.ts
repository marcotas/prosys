import type { HabitRepository } from '$lib/server/repositories/habit-repository';
import type { HabitWithDays } from '$lib/types';
import { ValidationError } from '$lib/server/domain/errors';
import { habitRepository } from '$lib/server/repositories/habit-repository';

export class GetMemberHabits {
	constructor(private readonly habitRepo: HabitRepository) {}

	execute(memberId: string, weekStart: string): HabitWithDays[] {
		if (!weekStart) throw new ValidationError('Missing week parameter');
		return this.habitRepo.findByMemberWithCompletions(memberId, weekStart);
	}
}

export const getMemberHabits = new GetMemberHabits(habitRepository);
