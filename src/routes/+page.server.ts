import { eq, and, asc, inArray } from 'drizzle-orm';
import type { Member, Task, HabitWithDays, ThemeVariant } from '$lib/types';
import { db } from '$lib/server/db';
import { familyMembers, tasks, habits, habitCompletions } from '$lib/server/db/schema';

// ── Row → domain helpers (mirrored from API routes) ─────

function rowToMember(row: typeof familyMembers.$inferSelect): Member {
	return {
		id: row.id,
		name: row.name,
		theme: {
			variant: row.themeVariant as ThemeVariant,
			accent: row.themeAccent,
			accentLight: row.themeAccentLight,
			accentDark: row.themeAccentDark,
			headerBg: row.themeHeaderBg,
			ringColor: row.themeRingColor,
			checkColor: row.themeCheckColor,
			emoji: row.themeEmoji
		},
		quote: { text: row.quoteText, author: row.quoteAuthor },
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function rowToTask(row: typeof tasks.$inferSelect): Task {
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

// ── Week start helper (server-side, no client date utils) ──

function getCurrentWeekStart(): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay(); // 0 = Sunday
	today.setDate(today.getDate() - dayOfWeek);
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

// ── Load function ──────────────────────────────────────────

export const load = async () => {
	// 1. Load all members
	const memberRows = db.select().from(familyMembers).all();
	const members: Member[] = memberRows.map(rowToMember);

	if (members.length === 0) {
		return { members: [], defaultMemberId: '', weekStart: '', tasks: [], habits: [] };
	}

	const defaultMember = members[0];
	const weekStart = getCurrentWeekStart();

	// 2. Load tasks for default member + current week
	const taskRows = db
		.select()
		.from(tasks)
		.where(and(eq(tasks.memberId, defaultMember.id), eq(tasks.weekStart, weekStart)))
		.orderBy(asc(tasks.dayIndex), asc(tasks.sortOrder))
		.all();
	const memberTasks: Task[] = taskRows.map(rowToTask);

	// 3. Load habits + completions for default member + current week
	const habitRows = db
		.select()
		.from(habits)
		.where(eq(habits.memberId, defaultMember.id))
		.orderBy(asc(habits.sortOrder))
		.all();

	let memberHabits: HabitWithDays[] = [];

	if (habitRows.length > 0) {
		const habitIds = habitRows.map((h) => h.id);
		const completionRows = db
			.select()
			.from(habitCompletions)
			.where(
				and(inArray(habitCompletions.habitId, habitIds), eq(habitCompletions.weekStart, weekStart))
			)
			.all();

		const completionMap = new Map<string, Set<number>>();
		for (const c of completionRows) {
			if (!completionMap.has(c.habitId)) {
				completionMap.set(c.habitId, new Set());
			}
			completionMap.get(c.habitId)!.add(c.dayIndex);
		}

		memberHabits = habitRows.map((row) => {
			const completedDays = completionMap.get(row.id) ?? new Set<number>();
			return {
				id: row.id,
				memberId: row.memberId,
				name: row.name,
				emoji: row.emoji ?? undefined,
				sortOrder: row.sortOrder,
				days: Array.from({ length: 7 }, (_, i) => completedDays.has(i))
			};
		});
	}

	return {
		members,
		defaultMemberId: defaultMember.id,
		weekStart,
		tasks: memberTasks,
		habits: memberHabits
	};
};
