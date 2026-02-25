import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { habits, habitCompletions, familyMembers } from '$lib/server/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import type { FamilyHabitProgress, ThemeVariant, HabitWithDays } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	const weekStart = url.searchParams.get('week');
	if (!weekStart) {
		return json({ error: 'week parameter is required' }, { status: 400 });
	}

	const members = db.select().from(familyMembers).all();

	const result: FamilyHabitProgress[] = members.map((member) => {
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

	return json(result);
};
