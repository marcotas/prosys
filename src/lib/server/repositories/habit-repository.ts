import { eq, and, asc, inArray, max } from 'drizzle-orm';
import { habits, habitCompletions, familyMembers } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { ID } from '$lib/domain/id';
import type { HabitData } from '$lib/domain/types';
import type { HabitWithDays, FamilyHabitProgress, ThemeVariant } from '$lib/types';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '$lib/server/db/schema';

type DbInstance = BetterSQLite3Database<typeof schema>;

// ── Row mapping ─────────────────────────────────────────

function rowToHabitData(row: typeof habits.$inferSelect): HabitData {
	return {
		id: row.id,
		memberId: row.memberId,
		name: row.name,
		emoji: row.emoji ?? undefined,
		sortOrder: row.sortOrder
	};
}

// ── Repository ──────────────────────────────────────────

export class HabitRepository {
	constructor(private readonly db: DbInstance) {}

	/**
	 * Find a single habit by ID.
	 */
	findById(id: string): HabitData | null {
		const row = this.db.select().from(habits).where(eq(habits.id, id)).get();
		return row ? rowToHabitData(row) : null;
	}

	/**
	 * Find all habits for a member, sorted by sortOrder.
	 */
	findByMember(memberId: string): HabitData[] {
		const rows = this.db
			.select()
			.from(habits)
			.where(eq(habits.memberId, memberId))
			.orderBy(asc(habits.sortOrder))
			.all();
		return rows.map(rowToHabitData);
	}

	/**
	 * Find habits for a member with weekly completion booleans (days array of 7).
	 */
	findByMemberWithCompletions(memberId: string, weekStart: string): HabitWithDays[] {
		const habitRows = this.db
			.select()
			.from(habits)
			.where(eq(habits.memberId, memberId))
			.orderBy(asc(habits.sortOrder))
			.all();

		if (habitRows.length === 0) return [];

		const habitIds = habitRows.map((h) => h.id);
		const completionRows = this.db
			.select()
			.from(habitCompletions)
			.where(
				and(
					inArray(habitCompletions.habitId, habitIds),
					eq(habitCompletions.weekStart, weekStart)
				)
			)
			.all();

		const completionMap = new Map<string, Set<number>>();
		for (const c of completionRows) {
			if (!completionMap.has(c.habitId)) {
				completionMap.set(c.habitId, new Set());
			}
			completionMap.get(c.habitId)!.add(c.dayIndex);
		}

		return habitRows.map((row) => {
			const completedDays = completionMap.get(row.id) ?? new Set<number>();
			return {
				...rowToHabitData(row),
				days: Array.from({ length: 7 }, (_, i) => completedDays.has(i))
			};
		});
	}

	/**
	 * Find all members' habits with completions, grouped by member.
	 */
	findFamilyWithCompletions(weekStart: string): FamilyHabitProgress[] {
		const members = this.db.select().from(familyMembers).all();

		return members.map((member) => {
			const memberHabits = this.findByMemberWithCompletions(member.id, weekStart);

			return {
				memberId: member.id,
				memberName: member.name,
				theme: {
					variant: member.themeVariant as ThemeVariant,
					accent: member.themeAccent,
					accentLight: member.themeAccentLight,
					accentDark: member.themeAccentDark,
					headerBg: member.themeHeaderBg,
					ringColor: member.themeRingColor,
					checkColor: member.themeCheckColor,
					emoji: member.themeEmoji
				},
				habits: memberHabits
			};
		});
	}

	/**
	 * Get the next sortOrder value for a member's habits.
	 * Returns 0 if the member has no habits.
	 */
	getNextSortOrder(memberId: string): number {
		const result = this.db
			.select({ maxSort: max(habits.sortOrder) })
			.from(habits)
			.where(eq(habits.memberId, memberId))
			.get();
		return (result?.maxSort ?? -1) + 1;
	}

	/**
	 * Insert a new habit row.
	 */
	insert(data: HabitData): void {
		const now = new Date().toISOString();
		this.db
			.insert(habits)
			.values({
				id: data.id,
				memberId: data.memberId,
				name: data.name,
				emoji: data.emoji ?? null,
				sortOrder: data.sortOrder,
				createdAt: now,
				updatedAt: now
			})
			.run();
	}

	/**
	 * Full row update for a habit.
	 */
	update(data: HabitData): void {
		const now = new Date().toISOString();
		this.db
			.update(habits)
			.set({
				memberId: data.memberId,
				name: data.name,
				emoji: data.emoji ?? null,
				sortOrder: data.sortOrder,
				updatedAt: now
			})
			.where(eq(habits.id, data.id))
			.run();
	}

	/**
	 * Partial update: only modifies specified fields.
	 */
	updatePartial(id: string, fields: Partial<HabitData>): void {
		const updates: Record<string, unknown> = {
			updatedAt: new Date().toISOString()
		};

		if ('name' in fields && fields.name !== undefined) updates.name = fields.name.trim();
		if ('emoji' in fields) updates.emoji = fields.emoji || null;
		if ('sortOrder' in fields && fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;
		if ('memberId' in fields && fields.memberId !== undefined) updates.memberId = fields.memberId;

		this.db.update(habits).set(updates).where(eq(habits.id, id)).run();
	}

	/**
	 * Delete a habit by ID. Completions cascade via FK.
	 */
	delete(id: string): void {
		this.db.delete(habits).where(eq(habits.id, id)).run();
	}

	/**
	 * Batch-reorder habits. Runs in a transaction, sets sortOrder = index.
	 */
	reorder(habitIds: string[], now: string): void {
		this.db.transaction((tx) => {
			for (let i = 0; i < habitIds.length; i++) {
				tx.update(habits)
					.set({ sortOrder: i, updatedAt: now })
					.where(eq(habits.id, habitIds[i]))
					.run();
			}
		});
	}

	/**
	 * Get all habit IDs belonging to a member (for reorder validation).
	 */
	findIdsByMember(memberId: string): string[] {
		const rows = this.db
			.select({ id: habits.id })
			.from(habits)
			.where(eq(habits.memberId, memberId))
			.all();
		return rows.map((r) => r.id);
	}

	/**
	 * Check if a completion record exists for a given habit/week/day.
	 */
	findCompletion(habitId: string, weekStart: string, dayIndex: number): boolean {
		const row = this.db
			.select()
			.from(habitCompletions)
			.where(
				and(
					eq(habitCompletions.habitId, habitId),
					eq(habitCompletions.weekStart, weekStart),
					eq(habitCompletions.dayIndex, dayIndex)
				)
			)
			.get();
		return !!row;
	}

	/**
	 * Insert a completion record.
	 */
	insertCompletion(habitId: string, weekStart: string, dayIndex: number): void {
		this.db
			.insert(habitCompletions)
			.values({
				id: ID.generate().toString(),
				habitId,
				weekStart,
				dayIndex,
				completed: true
			})
			.run();
	}

	/**
	 * Delete a completion record.
	 */
	deleteCompletion(habitId: string, weekStart: string, dayIndex: number): void {
		this.db
			.delete(habitCompletions)
			.where(
				and(
					eq(habitCompletions.habitId, habitId),
					eq(habitCompletions.weekStart, weekStart),
					eq(habitCompletions.dayIndex, dayIndex)
				)
			)
			.run();
	}
}

// ── Singleton ───────────────────────────────────────────

export const habitRepository = new HabitRepository(db);
