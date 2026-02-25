import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tasks, familyMembers } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { PlannerTask, ThemeVariant } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	const weekStart = url.searchParams.get('week');
	if (!weekStart) {
		return json({ error: 'week parameter is required' }, { status: 400 });
	}

	const rows = db
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

	const result: PlannerTask[] = rows.map((row) => ({
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

	return json(result);
};
