import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ── family_members ─────────────────────────────────────

export const familyMembers = sqliteTable('family_members', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	themeVariant: text('theme_variant').notNull().default('default'),
	themeAccent: text('theme_accent').notNull(),
	themeAccentLight: text('theme_accent_light').notNull(),
	themeAccentDark: text('theme_accent_dark').notNull(),
	themeHeaderBg: text('theme_header_bg').notNull(),
	themeRingColor: text('theme_ring_color').notNull(),
	themeCheckColor: text('theme_check_color').notNull(),
	themeEmoji: text('theme_emoji').notNull().default(''),
	quoteText: text('quote_text').notNull().default(''),
	quoteAuthor: text('quote_author').notNull().default(''),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

// ── tasks ──────────────────────────────────────────────

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('id').primaryKey(),
		memberId: text('member_id')
			.references(() => familyMembers.id, { onDelete: 'cascade' }),
		weekStart: text('week_start').notNull(),
		dayIndex: integer('day_index').notNull(),
		title: text('title').notNull(),
		emoji: text('emoji'),
		completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		status: text('status').notNull().default('active'),
		cancelledAt: text('cancelled_at'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('idx_tasks_member_week_day').on(table.memberId, table.weekStart, table.dayIndex),
		index('idx_tasks_week_day').on(table.weekStart, table.dayIndex)
	]
);

// ── habits ─────────────────────────────────────────────

export const habits = sqliteTable(
	'habits',
	{
		id: text('id').primaryKey(),
		memberId: text('member_id')
			.notNull()
			.references(() => familyMembers.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		emoji: text('emoji'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [index('idx_habits_member_order').on(table.memberId, table.sortOrder)]
);

// ── habit_completions ──────────────────────────────────

export const habitCompletions = sqliteTable(
	'habit_completions',
	{
		id: text('id').primaryKey(),
		habitId: text('habit_id')
			.notNull()
			.references(() => habits.id, { onDelete: 'cascade' }),
		weekStart: text('week_start').notNull(),
		dayIndex: integer('day_index').notNull(),
		completed: integer('completed', { mode: 'boolean' }).notNull().default(true)
	},
	(table) => [
		uniqueIndex('idx_habit_completions_unique').on(
			table.habitId,
			table.weekStart,
			table.dayIndex
		),
		index('idx_habit_completions_week').on(table.habitId, table.weekStart)
	]
);
