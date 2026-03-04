// Shared types for ProSys — read-only for feature tasks.
// All interfaces match the data model in docs/plan/data-model.md.

// ── Re-exports from domain layer ─────────────────────────
export type {
	DayIndex,
	ThemeVariant,
	ThemeConfig,
	MemberData,
	Member,
	TaskData,
	Task,
	HabitData,
	Habit,
	CreateTaskInput,
	UpdateTaskInput,
	CreateHabitInput,
	CreateMemberInput,
	UpdateMemberInput,
	ValidationResult
} from '$lib/domain/types';

import type { Task, ThemeConfig } from '$lib/domain/types';

// ── UI-only types (not part of domain) ───────────────────

export interface PlannerTask extends Task {
	memberName?: string;
	memberTheme?: ThemeConfig;
}

// ── Day (derived for UI, not stored) ───────────────────

export interface DayData {
	dayName: string;
	date: string; // DD.MM.YYYY display format
	isoDate: string; // YYYY-MM-DD for API
	tasks: Task[];
}

// ── Habit UI types ──────────────────────────────────────

export interface HabitWithDays {
	id: string;
	memberId: string;
	name: string;
	emoji?: string;
	sortOrder: number;
	days: boolean[]; // 7 booleans for Sun–Sat
}

export interface FamilyHabitProgress {
	memberId: string;
	memberName: string;
	theme: ThemeConfig;
	habits: HabitWithDays[];
}

// ── WebSocket Messages ─────────────────────────────────

export type WSMessage =
	| { type: 'task:created'; payload: Task }
	| { type: 'task:updated'; payload: Task }
	| { type: 'task:deleted'; payload: { id: string; memberId: string | null; weekStart: string; dayIndex: number } }
	| { type: 'task:reordered'; payload: { memberId: string | null; weekStart: string; dayIndex: number; taskIds: string[] } }
	| { type: 'task:moved'; payload: { task: Task; fromDay: number; fromWeek?: string } }
	| { type: 'habit:created'; payload: { id: string; memberId: string; name: string; emoji?: string; sortOrder: number } }
	| { type: 'habit:updated'; payload: { id: string; memberId: string; name: string; emoji?: string; sortOrder: number } }
	| { type: 'habit:deleted'; payload: { id: string; memberId: string } }
	| { type: 'habit:reordered'; payload: { memberId: string; habitIds: string[] } }
	| {
			type: 'habit:toggled';
			payload: { habitId: string; weekStart: string; dayIndex: number; completed: boolean };
		}
	| { type: 'member:created'; payload: { id: string; name: string; theme: ThemeConfig; quote: { text: string; author: string }; createdAt: string; updatedAt: string } }
	| { type: 'member:updated'; payload: { id: string; name: string; theme: ThemeConfig; quote: { text: string; author: string }; createdAt: string; updatedAt: string } }
	| { type: 'member:deleted'; payload: { id: string } };

// ── Theme Presets ──────────────────────────────────────

export const themePresets: { id: string; label: string; color: string; config: ThemeConfig }[] = [
	{
		id: 'green',
		label: 'Forest',
		color: '#4a7c59',
		config: {
			variant: 'default',
			accent: '#4a7c59',
			accentLight: '#dcfce7',
			accentDark: '#1e3a24',
			headerBg: '#4a7c59',
			ringColor: '#4a7c59',
			checkColor: '#4a7c59',
			emoji: ''
		}
	},
	{
		id: 'purple',
		label: 'Violet',
		color: '#8b5cf6',
		config: {
			variant: 'playful',
			accent: '#8b5cf6',
			accentLight: '#ede9fe',
			accentDark: '#4c1d95',
			headerBg: '#8b5cf6',
			ringColor: '#8b5cf6',
			checkColor: '#8b5cf6',
			emoji: '🦄'
		}
	},
	{
		id: 'pink',
		label: 'Rose',
		color: '#ec4899',
		config: {
			variant: 'playful',
			accent: '#ec4899',
			accentLight: '#fce7f3',
			accentDark: '#831843',
			headerBg: '#ec4899',
			ringColor: '#ec4899',
			checkColor: '#ec4899',
			emoji: '🌸'
		}
	},
	{
		id: 'blue',
		label: 'Ocean',
		color: '#3b82f6',
		config: {
			variant: 'playful',
			accent: '#3b82f6',
			accentLight: '#dbeafe',
			accentDark: '#1e3a5f',
			headerBg: '#3b82f6',
			ringColor: '#3b82f6',
			checkColor: '#3b82f6',
			emoji: '🚀'
		}
	},
	{
		id: 'orange',
		label: 'Sunset',
		color: '#f97316',
		config: {
			variant: 'playful',
			accent: '#f97316',
			accentLight: '#fff7ed',
			accentDark: '#7c2d12',
			headerBg: '#f97316',
			ringColor: '#f97316',
			checkColor: '#f97316',
			emoji: '🔥'
		}
	},
	{
		id: 'teal',
		label: 'Mint',
		color: '#14b8a6',
		config: {
			variant: 'default',
			accent: '#14b8a6',
			accentLight: '#ccfbf1',
			accentDark: '#134e4a',
			headerBg: '#14b8a6',
			ringColor: '#14b8a6',
			checkColor: '#14b8a6',
			emoji: ''
		}
	},
	{
		id: 'red',
		label: 'Cherry',
		color: '#ef4444',
		config: {
			variant: 'playful',
			accent: '#ef4444',
			accentLight: '#fef2f2',
			accentDark: '#7f1d1d',
			headerBg: '#ef4444',
			ringColor: '#ef4444',
			checkColor: '#ef4444',
			emoji: '🍒'
		}
	},
	{
		id: 'slate',
		label: 'Slate',
		color: '#475569',
		config: {
			variant: 'default',
			accent: '#475569',
			accentLight: '#f1f5f9',
			accentDark: '#1e293b',
			headerBg: '#475569',
			ringColor: '#475569',
			checkColor: '#475569',
			emoji: ''
		}
	}
];

// ── Emoji Options ──────────────────────────────────────

export const emojiOptions = [
	'🦄',
	'🌸',
	'🚀',
	'🔥',
	'🍒',
	'⭐',
	'🌈',
	'🎨',
	'🦋',
	'🐱',
	'🐶',
	'🦊',
	'🐼',
	'🐸',
	'🦁',
	'🐯',
	'🎮',
	'⚽',
	'🏀',
	'🎸',
	'🎹',
	'💃',
	'🤖',
	'🦸',
	'🌻',
	'🌙',
	'💎',
	'🍪',
	'🧸',
	'🎯',
	'🏰',
	'🌊'
];
