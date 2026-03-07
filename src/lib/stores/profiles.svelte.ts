import {
	familyMembers as defaultMembers,
	type FamilyMember,
	type ThemeConfig
} from '$lib/data/fake';

const STORAGE_KEY = 'prosys-profiles';

// Available theme presets for the picker
export const themePresets: {
	id: string;
	label: string;
	color: string;
	config: ThemeConfig;
}[] = [
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

function loadFromStorage(): FamilyMember[] | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		// ignore parse errors
	}
	return null;
}

function save(members: FamilyMember[]) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createProfileStore() {
	const stored = loadFromStorage();
	const members = $state<FamilyMember[]>(
		stored ?? structuredClone(defaultMembers)
	);

	return {
		get members() {
			return members;
		},

		addMember(profile: {
			name: string;
			theme: ThemeConfig;
			quote: { text: string; author: string };
		}): string {
			const id = generateId();
			const weekStart = '02.11.2025';
			const newMember: FamilyMember = {
				id,
				name: profile.name,
				theme: profile.theme,
				quote: profile.quote,
				weekStart,
				days: [
					{ dayName: 'Sunday', date: '02.11.2025', tasks: [] },
					{ dayName: 'Monday', date: '03.11.2025', tasks: [] },
					{ dayName: 'Tuesday', date: '04.11.2025', tasks: [] },
					{ dayName: 'Wednesday', date: '05.11.2025', tasks: [] },
					{ dayName: 'Thursday', date: '06.11.2025', tasks: [] },
					{ dayName: 'Friday', date: '07.11.2025', tasks: [] },
					{ dayName: 'Saturday', date: '08.11.2025', tasks: [] }
				],
				habits: []
			};
			members.push(newMember);
			save(members);
			return id;
		},

		updateMember(
			id: string,
			updates: {
				name?: string;
				theme?: ThemeConfig;
				quote?: { text: string; author: string };
			}
		) {
			const member = members.find((m) => m.id === id);
			if (!member) return;
			if (updates.name !== undefined) member.name = updates.name;
			if (updates.theme !== undefined) member.theme = updates.theme;
			if (updates.quote !== undefined) member.quote = updates.quote;
			save(members);
		},

		deleteMember(id: string) {
			const idx = members.findIndex((m) => m.id === id);
			if (idx !== -1) {
				members.splice(idx, 1);
				save(members);
			}
		},

		addTask(
			memberId: string,
			dayIndex: number,
			title: string,
			emoji?: string
		) {
			const member = members.find((m) => m.id === memberId);
			if (!member || dayIndex < 0 || dayIndex >= member.days.length) return;
			const taskId = generateId();
			member.days[dayIndex].tasks.push({
				id: taskId,
				title,
				completed: false,
				...(emoji ? { emoji } : {})
			});
			save(members);
			return taskId;
		},

		updateTask(
			memberId: string,
			dayIndex: number,
			taskId: string,
			updates: { title?: string; emoji?: string }
		) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const task = member.days[dayIndex]?.tasks.find((t) => t.id === taskId);
			if (!task) return;
			if (updates.title !== undefined) task.title = updates.title;
			if (updates.emoji !== undefined) task.emoji = updates.emoji || undefined;
			save(members);
		},

		deleteTask(memberId: string, dayIndex: number, taskId: string) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const day = member.days[dayIndex];
			if (!day) return;
			const idx = day.tasks.findIndex((t) => t.id === taskId);
			if (idx !== -1) {
				day.tasks.splice(idx, 1);
				save(members);
			}
		},

		addHabit(memberId: string, name: string, emoji?: string) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const habitId = generateId();
			member.habits.push({
				id: habitId,
				name,
				...(emoji ? { emoji } : {}),
				days: [false, false, false, false, false, false, false]
			});
			save(members);
			return habitId;
		},

		updateHabit(
			memberId: string,
			habitId: string,
			updates: { name?: string; emoji?: string }
		) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const habit = member.habits.find((h) => h.id === habitId);
			if (!habit) return;
			if (updates.name !== undefined) habit.name = updates.name;
			if (updates.emoji !== undefined) habit.emoji = updates.emoji || undefined;
			save(members);
		},

		deleteHabit(memberId: string, habitId: string) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const idx = member.habits.findIndex((h) => h.id === habitId);
			if (idx !== -1) {
				member.habits.splice(idx, 1);
				save(members);
			}
		},

		moveTask(
			memberId: string,
			fromDay: number,
			toDay: number,
			taskId: string
		) {
			const member = members.find((m) => m.id === memberId);
			if (!member) return;
			const srcDay = member.days[fromDay];
			const dstDay = member.days[toDay];
			if (!srcDay || !dstDay) return;
			const taskIdx = srcDay.tasks.findIndex((t) => t.id === taskId);
			if (taskIdx === -1) return;
			const [task] = srcDay.tasks.splice(taskIdx, 1);
			dstDay.tasks.push(task);
			save(members);
		},

		persist() {
			save(members);
		},

		resetToDefaults() {
			members.length = 0;
			members.push(...structuredClone(defaultMembers));
			save(members);
		}
	};
}

export const profileStore = createProfileStore();
