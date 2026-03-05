import type { TaskData, CreateTaskInput } from './types';
import { isoToDate } from '$lib/utils/dates';
import { ID } from './id';

export class Task {
	private constructor(private data: TaskData) {}

	static create(input: CreateTaskInput): Task {
		const errors: string[] = [];

		if (!input.title?.trim()) errors.push('Title is required');
		if (input.dayIndex === undefined || input.dayIndex < 0 || input.dayIndex > 6)
			errors.push('Day index must be 0-6');
		if (!input.weekStart?.trim()) {
			errors.push('Week start is required');
		} else {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart))
				errors.push('Week start must be YYYY-MM-DD format');
			else if (isoToDate(input.weekStart).getDay() !== 0)
				errors.push('Week must start on Sunday');
		}

		if (errors.length > 0) throw new Error(errors.join('; '));

		return new Task({
			id: ID.generate().toString(),
			memberId: input.memberId ?? null,
			weekStart: input.weekStart,
			dayIndex: input.dayIndex,
			title: input.title.trim(),
			emoji: input.emoji,
			completed: false,
			sortOrder: 0
		});
	}

	static fromData(data: TaskData): Task {
		return new Task({ ...data });
	}

	// ── Getters ──────────────────────────────────────────

	get id(): string {
		return this.data.id;
	}
	get title(): string {
		return this.data.title;
	}
	get memberId(): string | null {
		return this.data.memberId;
	}
	get weekStart(): string {
		return this.data.weekStart;
	}
	get dayIndex(): number {
		return this.data.dayIndex;
	}
	get emoji(): string | undefined {
		return this.data.emoji;
	}
	get isCompleted(): boolean {
		return this.data.completed;
	}
	get sortOrder(): number {
		return this.data.sortOrder;
	}

	// ── Mutations ────────────────────────────────────────

	complete(): void {
		this.data.completed = true;
	}

	uncomplete(): void {
		this.data.completed = false;
	}

	toggleCompletion(): void {
		this.data.completed = !this.data.completed;
	}

	updateTitle(title: string): void {
		if (!title.trim()) throw new Error('Title cannot be empty');
		this.data.title = title.trim();
	}

	updateEmoji(emoji: string | undefined): void {
		this.data.emoji = emoji;
	}

	setSortOrder(sortOrder: number): void {
		this.data.sortOrder = sortOrder;
	}

	setDay(dayIndex: number, weekStart: string, sortOrder: number): void {
		if (dayIndex < 0 || dayIndex > 6) throw new Error('Day index must be 0-6');
		this.data.dayIndex = dayIndex;
		this.data.weekStart = weekStart;
		this.data.sortOrder = sortOrder;
	}

	assignTo(memberId: string | null): void {
		this.data.memberId = memberId;
	}

	// ── Query ────────────────────────────────────────────

	isMove(updates: { dayIndex?: number; weekStart?: string }): boolean {
		return (
			(updates.dayIndex !== undefined && updates.dayIndex !== this.data.dayIndex) ||
			(updates.weekStart !== undefined && updates.weekStart !== this.data.weekStart)
		);
	}

	// ── Serialization ────────────────────────────────────

	toJSON(): TaskData {
		return { ...this.data };
	}

	clone(): Task {
		return Task.fromData(this.toJSON());
	}
}
