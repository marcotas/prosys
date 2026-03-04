// Domain entity types — pure TypeScript, zero framework imports.
// These are the canonical definitions shared between client and server.

// ── Value Types ──────────────────────────────────────────

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ThemeVariant = 'default' | 'playful';

export interface ThemeConfig {
	variant: ThemeVariant;
	accent: string;
	accentLight: string;
	accentDark: string;
	headerBg: string;
	ringColor: string;
	checkColor: string;
	emoji: string;
}

// ── Entity Data Types ───────────────────────────────────
// These represent the plain data shape of each entity.
// Entity classes wrap these internally and expose them via toJSON().

export interface MemberData {
	id: string;
	name: string;
	theme: ThemeConfig;
	quote: { text: string; author: string };
	createdAt: string;
	updatedAt: string;
}

export interface TaskData {
	id: string;
	memberId: string | null;
	weekStart: string; // ISO date of week's Sunday, e.g. '2026-02-08'
	dayIndex: number; // 0=Sun … 6=Sat
	title: string;
	emoji?: string;
	completed: boolean;
	sortOrder: number;
}

export interface HabitData {
	id: string;
	memberId: string;
	name: string;
	emoji?: string;
	sortOrder: number;
}

// ── Backward-compat aliases ─────────────────────────────
// The rest of the codebase imports these names. Keep them working
// until migration to entity classes is complete.

export type Member = MemberData;
export type Task = TaskData;
export type Habit = HabitData;

// ── Input Types ──────────────────────────────────────────

export type CreateTaskInput = {
	memberId?: string | null;
	weekStart: string;
	dayIndex: number;
	title: string;
	emoji?: string;
};

export type UpdateTaskInput = {
	title?: string;
	emoji?: string;
	completed?: boolean;
	dayIndex?: number;
	sortOrder?: number;
	memberId?: string | null;
	weekStart?: string;
};

export type CreateHabitInput = {
	memberId: string;
	name: string;
	emoji?: string;
};

export type CreateMemberInput = {
	name: string;
	theme: ThemeConfig;
	quote: { text: string; author: string };
};

export type UpdateMemberInput = {
	name?: string;
	theme?: ThemeConfig;
	quote?: { text: string; author: string };
};

// ── Validation ───────────────────────────────────────────

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };
