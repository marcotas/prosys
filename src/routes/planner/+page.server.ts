import { eq, and, asc, inArray } from 'drizzle-orm';
import type { Member, PlannerTask, FamilyHabitProgress, ThemeVariant, HabitWithDays } from '$lib/types';
import { db } from '$lib/server/db';
import { familyMembers, tasks, habits, habitCompletions } from '$lib/server/db/schema';

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

function getCurrentWeekStart(): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay();
	today.setDate(today.getDate() - dayOfWeek);
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export const load = async () => {
	const memberRows = db.select().from(familyMembers).all();
	const members: Member[] = memberRows.map(rowToMember);
	const weekStart = getCurrentWeekStart();

	// Load ALL tasks for this week (all members + unassigned)
	const taskRows = db
		.select({
			id: tasks.id,
			memberId: tasks.memberId,
			weekStart: tasks.weekStart,
			dayIndex: tasks.dayIndex,
			title: tasks.title,
			emoji: tasks.emoji,
			completed: tasks.completed,
			sortOrder: tasks.sortOrder,
			status: tasks.status,
			cancelledAt: tasks.cancelledAt,
			rescheduleCount: tasks.rescheduleCount,
			rescheduledFromId: tasks.rescheduledFromId,
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

	const allTasks: PlannerTask[] = taskRows.map((row) => ({
		id: row.id,
		memberId: row.memberId ?? null,
		weekStart: row.weekStart,
		dayIndex: row.dayIndex,
		title: row.title,
		emoji: row.emoji ?? undefined,
		completed: row.completed,
		sortOrder: row.sortOrder,
		status: row.status as PlannerTask['status'],
		cancelledAt: row.cancelledAt ?? null,
		rescheduleCount: row.rescheduleCount,
		rescheduledFromId: row.rescheduledFromId ?? null,
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

	// Load habits + completions for ALL members
	const habitProgress: FamilyHabitProgress[] = members.map((member) => {
		const habitRows = db
			.select()
			.from(habits)
			.where(eq(habits.memberId, member.id))
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
			memberId: member.id,
			memberName: member.name,
			theme: member.theme,
			habits: memberHabits
		};
	});

	return {
		members,
		weekStart,
		tasks: allTasks,
		habitProgress
	};
};
