import { ID } from './id';
import type { HabitData, CreateHabitInput } from './types';

export class Habit {
	private constructor(private data: HabitData) {}

	static create(input: CreateHabitInput): Habit {
		const errors: string[] = [];
		if (!input.name?.trim()) errors.push('Name is required');
		if (!input.memberId?.trim()) errors.push('Member ID is required');
		if (errors.length > 0) throw new Error(errors.join('; '));

		return new Habit({
			id: ID.generate().toString(),
			memberId: input.memberId,
			name: input.name.trim(),
			emoji: input.emoji,
			sortOrder: 0
		});
	}

	static fromData(data: HabitData): Habit {
		return new Habit({ ...data });
	}

	// ── Getters ──────────────────────────────────────────

	get id(): string {
		return this.data.id;
	}

	get memberId(): string {
		return this.data.memberId;
	}

	get name(): string {
		return this.data.name;
	}

	get emoji(): string | undefined {
		return this.data.emoji;
	}

	get sortOrder(): number {
		return this.data.sortOrder;
	}

	// ── Mutations ────────────────────────────────────────

	updateName(name: string): void {
		if (!name.trim()) throw new Error('Name cannot be empty');
		this.data.name = name.trim();
	}

	updateEmoji(emoji: string | undefined): void {
		this.data.emoji = emoji;
	}

	setSortOrder(sortOrder: number): void {
		this.data.sortOrder = sortOrder;
	}

	// ── Serialization ────────────────────────────────────

	toJSON(): HabitData {
		return { ...this.data };
	}

	clone(): Habit {
		return Habit.fromData(this.toJSON());
	}
}
