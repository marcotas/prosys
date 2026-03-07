import { eq, and, asc, max } from 'drizzle-orm';
import type { TaskData, ThemeVariant } from '$lib/domain/types';
import type * as schema from '$lib/server/db/schema';
import type { Database } from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { tasks, familyMembers } from '$lib/server/db/schema';

// ── Row-to-Domain Mapper ────────────────────────────────

type TaskRow = typeof tasks.$inferSelect;

function rowToTaskData(row: TaskRow): TaskData {
	return {
		id: row.id,
		memberId: row.memberId ?? null,
		weekStart: row.weekStart,
		dayIndex: row.dayIndex,
		title: row.title,
		emoji: row.emoji ?? undefined,
		completed: row.completed,
		sortOrder: row.sortOrder
	};
}

// ── PlannerTask result type ─────────────────────────────
// Enriched task with LEFT JOINed member info.
// Mirrors the PlannerTask interface from $lib/types but defined
// here to avoid importing UI-layer types into the repository.

export interface PlannerTaskRow extends TaskData {
	memberName?: string;
	memberTheme?: {
		variant: string;
		accent: string;
		accentLight: string;
		accentDark: string;
		headerBg: string;
		ringColor: string;
		checkColor: string;
		emoji: string;
	};
}

// ── Insert/Update row types ─────────────────────────────

interface TaskInsertRow {
	id: string;
	memberId: string | null;
	weekStart: string;
	dayIndex: number;
	title: string;
	emoji: string | null;
	completed: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

// ── TaskRepository ──────────────────────────────────────

export class TaskRepository {
	constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

	/**
	 * Find a single task by ID.
	 * Returns null if not found.
	 */
	findById(id: string): TaskData | null {
		const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get();
		return row ? rowToTaskData(row) : null;
	}

	/**
	 * Find all tasks for a member in a given week, sorted by dayIndex then sortOrder.
	 */
	findByMemberAndWeek(memberId: string, weekStart: string): TaskData[] {
		const rows = this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart)))
			.orderBy(asc(tasks.dayIndex), asc(tasks.sortOrder))
			.all();

		return rows.map(rowToTaskData);
	}

	/**
	 * Find all tasks for a week with LEFT JOINed member info.
	 * Returns enriched rows sorted by dayIndex then sortOrder.
	 */
	findFamilyWeek(weekStart: string): PlannerTaskRow[] {
		const rows = this.db
			.select({
				id: tasks.id,
				memberId: tasks.memberId,
				weekStart: tasks.weekStart,
				dayIndex: tasks.dayIndex,
				title: tasks.title,
				emoji: tasks.emoji,
				completed: tasks.completed,
				sortOrder: tasks.sortOrder,
				memberName: familyMembers.name,
				memberThemeVariant: familyMembers.themeVariant,
				memberThemeAccent: familyMembers.themeAccent,
				memberThemeAccentLight: familyMembers.themeAccentLight,
				memberThemeAccentDark: familyMembers.themeAccentDark,
				memberThemeHeaderBg: familyMembers.themeHeaderBg,
				memberThemeRingColor: familyMembers.themeRingColor,
				memberThemeCheckColor: familyMembers.themeCheckColor,
				memberThemeEmoji: familyMembers.themeEmoji
			})
			.from(tasks)
			.leftJoin(familyMembers, eq(tasks.memberId, familyMembers.id))
			.where(eq(tasks.weekStart, weekStart))
			.orderBy(asc(tasks.dayIndex), asc(tasks.sortOrder))
			.all();

		return rows.map((row) => ({
			id: row.id,
			memberId: row.memberId ?? null,
			weekStart: row.weekStart,
			dayIndex: row.dayIndex,
			title: row.title,
			emoji: row.emoji ?? undefined,
			completed: row.completed,
			sortOrder: row.sortOrder,
			memberName: row.memberName ?? undefined,
			memberTheme: row.memberName
				? {
					variant: (row.memberThemeVariant ?? 'default') as ThemeVariant,
					accent: row.memberThemeAccent!,
					accentLight: row.memberThemeAccentLight!,
					accentDark: row.memberThemeAccentDark!,
					headerBg: row.memberThemeHeaderBg!,
					ringColor: row.memberThemeRingColor!,
					checkColor: row.memberThemeCheckColor!,
					emoji: row.memberThemeEmoji ?? ''
				}
				: undefined
		}));
	}

	/**
	 * Get the next sortOrder value for a day slot.
	 * Returns max(sortOrder) + 1, or 0 if no tasks exist in the slot.
	 */
	getNextSortOrder(memberId: string | null, weekStart: string, dayIndex: number): number {
		const conditions = memberId
			? and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart), eq(tasks.dayIndex, dayIndex))
			: and(eq(tasks.weekStart, weekStart), eq(tasks.dayIndex, dayIndex));

		const result = this.db
			.select({ maxSort: max(tasks.sortOrder) })
			.from(tasks)
			.where(conditions)
			.get();

		return (result?.maxSort ?? -1) + 1;
	}

	/**
	 * Insert a new task row.
	 */
	insert(data: TaskData): void {
		const now = new Date().toISOString();
		const row: TaskInsertRow = {
			id: data.id,
			memberId: data.memberId ?? null,
			weekStart: data.weekStart,
			dayIndex: data.dayIndex,
			title: data.title,
			emoji: data.emoji ?? null,
			completed: data.completed,
			sortOrder: data.sortOrder,
			createdAt: now,
			updatedAt: now
		};

		this.db.insert(tasks).values(row).run();
	}

	/**
	 * Full row update (replaces all mutable fields).
	 */
	update(data: TaskData): void {
		const now = new Date().toISOString();
		this.db
			.update(tasks)
			.set({
				memberId: data.memberId ?? null,
				weekStart: data.weekStart,
				dayIndex: data.dayIndex,
				title: data.title,
				emoji: data.emoji ?? null,
				completed: data.completed,
				sortOrder: data.sortOrder,
				updatedAt: now
			})
			.where(eq(tasks.id, data.id))
			.run();
	}

	/**
	 * Partial update -- only modifies the specified fields.
	 * Accepts a subset of TaskData fields (excluding id).
	 */
	updatePartial(id: string, fields: Partial<Omit<TaskData, 'id'>>): void {
		const updates: Record<string, string | number | boolean | null> = {
			updatedAt: new Date().toISOString()
		};

		if (fields.title !== undefined) updates.title = fields.title.trim();
		if (fields.emoji !== undefined) updates.emoji = fields.emoji || null;
		if (fields.completed !== undefined) updates.completed = fields.completed;
		if (fields.dayIndex !== undefined) updates.dayIndex = fields.dayIndex;
		if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;
		if (fields.memberId !== undefined) updates.memberId = fields.memberId ?? null;
		if (fields.weekStart !== undefined) updates.weekStart = fields.weekStart;

		this.db.update(tasks).set(updates).where(eq(tasks.id, id)).run();
	}

	/**
	 * Delete a task by ID.
	 */
	delete(id: string): void {
		this.db.delete(tasks).where(eq(tasks.id, id)).run();
	}

	/**
	 * Reorder tasks by setting sortOrder = index for each task ID.
	 * Runs in a transaction for atomicity.
	 */
	reorder(taskIds: string[], now: string): void {
		// Access the underlying better-sqlite3 instance for raw SQL transaction
		// since Drizzle's .transaction() has overhead for bulk updates.
		const client = this.db.$client as Database;
		const stmt = client.prepare(
			'UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?'
		);

		const transaction = client.transaction(() => {
			for (let i = 0; i < taskIds.length; i++) {
				stmt.run(i, now, taskIds[i]);
			}
		});

		transaction();
	}

	/**
	 * Return task IDs for a specific day slot, used for reorder validation.
	 */
	findIdsByDay(memberId: string | null, weekStart: string, dayIndex: number): string[] {
		const conditions = memberId
			? and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart), eq(tasks.dayIndex, dayIndex))
			: and(eq(tasks.weekStart, weekStart), eq(tasks.dayIndex, dayIndex));

		const rows = this.db
			.select({ id: tasks.id })
			.from(tasks)
			.where(conditions)
			.all();

		return rows.map((r) => r.id);
	}
}

// ── Singleton instance ──────────────────────────────────

export const taskRepository = new TaskRepository(db);
