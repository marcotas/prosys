// Fake data for the prototype - mirrors the spreadsheet layout

export type ThemeVariant = 'default' | 'playful';

export interface ThemeConfig {
	variant: ThemeVariant;
	accent: string; // primary accent color
	accentLight: string; // lighter shade for backgrounds
	accentDark: string; // darker shade for text
	headerBg: string; // day card header bg
	ringColor: string; // progress ring stroke
	checkColor: string; // checkbox checked bg
	emoji: string; // avatar emoji for kids
}

export interface Task {
	id: string;
	title: string;
	completed: boolean;
	emoji?: string; // optional emoji prefix for kid tasks
}

export interface DayData {
	dayName: string;
	date: string;
	tasks: Task[];
}

export interface Habit {
	id: string;
	name: string;
	emoji?: string;
	days: boolean[]; // 7 booleans for Sun-Sat
}

export interface FamilyMember {
	id: string;
	name: string;
	theme: ThemeConfig;
	quote: { text: string; author: string };
	weekStart: string;
	days: DayData[];
	habits: Habit[];
}

// Theme definitions
export const themes: Record<string, ThemeConfig> = {
	marco: {
		variant: 'default',
		accent: '#4a7c59',
		accentLight: '#dcfce7',
		accentDark: '#1e3a24',
		headerBg: '#4a7c59',
		ringColor: '#4a7c59',
		checkColor: '#4a7c59',
		emoji: ''
	},
	alice: {
		variant: 'playful',
		accent: '#8b5cf6',
		accentLight: '#ede9fe',
		accentDark: '#4c1d95',
		headerBg: '#8b5cf6',
		ringColor: '#8b5cf6',
		checkColor: '#8b5cf6',
		emoji: '🦄'
	},
	susana: {
		variant: 'playful',
		accent: '#ec4899',
		accentLight: '#fce7f3',
		accentDark: '#831843',
		headerBg: '#ec4899',
		ringColor: '#ec4899',
		checkColor: '#ec4899',
		emoji: '🌸'
	},
	pedro: {
		variant: 'playful',
		accent: '#3b82f6',
		accentLight: '#dbeafe',
		accentDark: '#1e3a5f',
		headerBg: '#3b82f6',
		ringColor: '#3b82f6',
		checkColor: '#3b82f6',
		emoji: '🚀'
	}
};

export const familyMembers: FamilyMember[] = [
	{
		id: '1',
		name: 'Marco',
		theme: themes.marco,
		quote: {
			text: 'Tiny Changes, Remarkable Results',
			author: 'James Clear'
		},
		weekStart: '02.11.2025',
		days: [
			{
				dayName: 'Sunday',
				date: '02.11.2025',
				tasks: [
					{ id: 's1', title: 'Create a development plan', completed: true },
					{ id: 's2', title: 'Reels script', completed: true },
					{ id: 's3', title: 'Analyze the marketing report', completed: true },
					{ id: 's4', title: 'Finish the project due Oct 31', completed: true },
					{ id: 's5', title: 'Set up website traffic', completed: false },
					{ id: 's6', title: 'Pay the targeting specialist', completed: false }
				]
			},
			{
				dayName: 'Monday',
				date: '03.11.2025',
				tasks: [
					{ id: 'm1', title: 'Organize personal finances', completed: true },
					{ id: 'm2', title: 'Write 10 content ideas', completed: true },
					{ id: 'm3', title: 'Prepare the commercial proposal', completed: true },
					{ id: 'm4', title: 'Review subscriptions', completed: true },
					{ id: 'm5', title: 'Organize the workspace', completed: true },
					{ id: 'm6', title: 'Call Sarah', completed: true },
					{ id: 'm7', title: 'Renew gym membership', completed: false }
				]
			},
			{
				dayName: 'Tuesday',
				date: '04.11.2025',
				tasks: [
					{ id: 't1', title: 'Hire a personal trainer', completed: true },
					{ id: 't2', title: 'Buy groceries for the week', completed: true },
					{ id: 't3', title: 'Deep clean the apartment', completed: true },
					{ id: 't4', title: "Doctor's appointment", completed: true },
					{ id: 't5', title: 'Buy vitamins', completed: false }
				]
			},
			{
				dayName: 'Wednesday',
				date: '05.11.2025',
				tasks: [
					{ id: 'w1', title: 'Film content for the new project', completed: true },
					{ id: 'w2', title: 'Water the plants', completed: true },
					{ id: 'w3', title: 'Meet up with friends', completed: true },
					{ id: 'w4', title: 'Redesign the website', completed: false },
					{ id: 'w5', title: 'Grocery shopping', completed: false }
				]
			},
			{
				dayName: 'Thursday',
				date: '06.11.2025',
				tasks: [
					{ id: 'th1', title: 'Check email', completed: true },
					{ id: 'th2', title: 'Reply to urgent matters', completed: false },
					{ id: 'th3', title: 'Review financial report', completed: false },
					{ id: 'th4', title: 'Team meeting', completed: false },
					{ id: 'th5', title: 'Reconcile expenses and payments', completed: false },
					{ id: 'th6', title: 'Check sales metrics', completed: false }
				]
			},
			{
				dayName: 'Friday',
				date: '07.11.2025',
				tasks: [
					{ id: 'f1', title: 'Post about the company on social', completed: true },
					{ id: 'f2', title: "Update the team's task list", completed: true },
					{ id: 'f3', title: 'Order cleaning services', completed: true },
					{ id: 'f4', title: 'Review tax declarations', completed: true },
					{ id: 'f5', title: 'Check mentions', completed: false }
				]
			},
			{
				dayName: 'Saturday',
				date: '08.11.2025',
				tasks: [
					{ id: 'sa1', title: 'Make edits to the commercial project', completed: true },
					{ id: 'sa2', title: 'Approve the candidate with HR', completed: true },
					{ id: 'sa3', title: 'Study market moves', completed: true },
					{ id: 'sa4', title: 'Research competitions', completed: true },
					{ id: 'sa5', title: 'Pay the bills', completed: true },
					{ id: 'sa6', title: 'Approve the design', completed: false },
					{ id: 'sa7', title: 'Send the technical requirements', completed: false }
				]
			}
		],
		habits: [
			{ id: 'h1', name: 'Wake up at 06:00', days: [true, true, false, true, false, false, false] },
			{ id: 'h2', name: 'No alcohol', days: [true, true, true, true, true, true, true] },
			{ id: 'h3', name: 'Cold shower', days: [false, true, false, true, false, false, false] },
			{ id: 'h4', name: '1 hour on social media', days: [true, true, true, false, true, true, false] },
			{ id: 'h5', name: 'Budget tracking', days: [true, true, true, true, true, false, true] },
			{ id: 'h6', name: 'Gym', days: [true, true, true, true, true, false, true] },
			{ id: 'h7', name: 'Reading', days: [true, true, true, false, true, true, false] },
			{ id: 'h8', name: 'English', days: [false, true, true, false, false, true, false] }
		]
	},
	{
		id: '2',
		name: 'Alice',
		theme: themes.alice,
		quote: {
			text: 'Be yourself; everyone else is already taken',
			author: 'Oscar Wilde'
		},
		weekStart: '02.11.2025',
		days: [
			{
				dayName: 'Sunday',
				date: '02.11.2025',
				tasks: [
					{ id: 'a-s1', title: 'Finish math homework', completed: true, emoji: '📐' },
					{ id: 'a-s2', title: 'Read 20 pages of Harry Potter', completed: true, emoji: '📖' },
					{ id: 'a-s3', title: 'Practice piano for 30 min', completed: false, emoji: '🎹' },
					{ id: 'a-s4', title: 'Clean my room', completed: false, emoji: '🧹' }
				]
			},
			{
				dayName: 'Monday',
				date: '03.11.2025',
				tasks: [
					{ id: 'a-m1', title: 'Study for science test', completed: true, emoji: '🔬' },
					{ id: 'a-m2', title: 'Art project - draw animals', completed: true, emoji: '🎨' },
					{ id: 'a-m3', title: 'Walk the dog', completed: true, emoji: '🐕' },
					{ id: 'a-m4', title: 'Pack school bag for tomorrow', completed: true, emoji: '🎒' }
				]
			},
			{
				dayName: 'Tuesday',
				date: '04.11.2025',
				tasks: [
					{ id: 'a-t1', title: 'Spelling practice', completed: true, emoji: '✏️' },
					{ id: 'a-t2', title: 'Help set the dinner table', completed: true, emoji: '🍽️' },
					{ id: 'a-t3', title: 'Dance class at 4pm', completed: true, emoji: '💃' }
				]
			},
			{
				dayName: 'Wednesday',
				date: '05.11.2025',
				tasks: [
					{ id: 'a-w1', title: 'Write in my journal', completed: true, emoji: '📓' },
					{ id: 'a-w2', title: 'Soccer practice', completed: true, emoji: '⚽' },
					{ id: 'a-w3', title: 'Read before bed', completed: false, emoji: '📖' }
				]
			},
			{
				dayName: 'Thursday',
				date: '06.11.2025',
				tasks: [
					{ id: 'a-th1', title: 'History project research', completed: true, emoji: '🏛️' },
					{ id: 'a-th2', title: 'Practice multiplication tables', completed: false, emoji: '✖️' },
					{ id: 'a-th3', title: 'Tidy up the playroom', completed: false, emoji: '🧸' }
				]
			},
			{
				dayName: 'Friday',
				date: '07.11.2025',
				tasks: [
					{ id: 'a-f1', title: 'Bake cookies with mom', completed: true, emoji: '🍪' },
					{ id: 'a-f2', title: 'Movie night - pick a film', completed: true, emoji: '🎬' },
					{ id: 'a-f3', title: 'Finish reading chapter 5', completed: false, emoji: '📖' }
				]
			},
			{
				dayName: 'Saturday',
				date: '08.11.2025',
				tasks: [
					{ id: 'a-sa1', title: 'Swimming lesson', completed: true, emoji: '🏊' },
					{ id: 'a-sa2', title: 'Build a blanket fort', completed: true, emoji: '🏰' },
					{ id: 'a-sa3', title: 'Water the garden plants', completed: true, emoji: '🌻' },
					{ id: 'a-sa4', title: 'Write thank-you card for grandma', completed: false, emoji: '💌' }
				]
			}
		],
		habits: [
			{ id: 'ah1', name: 'Make my bed', emoji: '🛏️', days: [true, true, true, true, false, true, true] },
			{ id: 'ah2', name: 'Brush teeth 2x', emoji: '🪥', days: [true, true, true, true, true, true, true] },
			{ id: 'ah3', name: 'Read 20 min', emoji: '📚', days: [true, true, false, true, false, true, false] },
			{ id: 'ah4', name: 'No screens after 8pm', emoji: '📵', days: [true, false, true, true, true, false, true] },
			{ id: 'ah5', name: 'Drink 6 glasses of water', emoji: '💧', days: [false, true, true, false, true, true, false] },
			{ id: 'ah6', name: 'Be kind to someone', emoji: '💜', days: [true, true, true, true, true, true, true] }
		]
	},
	{
		id: '3',
		name: 'Susana',
		theme: themes.susana,
		quote: {
			text: 'You are braver than you believe, stronger than you seem, and smarter than you think',
			author: 'Winnie the Pooh'
		},
		weekStart: '02.11.2025',
		days: [
			{
				dayName: 'Sunday',
				date: '02.11.2025',
				tasks: [
					{ id: 'su-s1', title: 'Color the butterfly worksheet', completed: true, emoji: '🦋' },
					{ id: 'su-s2', title: 'Practice writing letters A-F', completed: true, emoji: '✍️' },
					{ id: 'su-s3', title: 'Play outside for 30 min', completed: true, emoji: '🌈' },
					{ id: 'su-s4', title: 'Put toys away', completed: false, emoji: '🧸' }
				]
			},
			{
				dayName: 'Monday',
				date: '03.11.2025',
				tasks: [
					{ id: 'su-m1', title: 'Count to 50 practice', completed: true, emoji: '🔢' },
					{ id: 'su-m2', title: 'Feed the fish', completed: true, emoji: '🐠' },
					{ id: 'su-m3', title: 'Story time with dad', completed: true, emoji: '📖' }
				]
			},
			{
				dayName: 'Tuesday',
				date: '04.11.2025',
				tasks: [
					{ id: 'su-t1', title: 'Gymnastics class', completed: true, emoji: '🤸' },
					{ id: 'su-t2', title: 'Draw a family picture', completed: true, emoji: '👨‍👩‍👧‍👦' },
					{ id: 'su-t3', title: 'Help water the flowers', completed: false, emoji: '🌷' }
				]
			},
			{
				dayName: 'Wednesday',
				date: '05.11.2025',
				tasks: [
					{ id: 'su-w1', title: 'Play date with Emma', completed: true, emoji: '👯' },
					{ id: 'su-w2', title: 'Practice tying shoelaces', completed: false, emoji: '👟' },
					{ id: 'su-w3', title: 'Build a puzzle', completed: true, emoji: '🧩' }
				]
			},
			{
				dayName: 'Thursday',
				date: '06.11.2025',
				tasks: [
					{ id: 'su-th1', title: 'Music class - sing songs', completed: true, emoji: '🎵' },
					{ id: 'su-th2', title: 'Help bake bread', completed: false, emoji: '🍞' },
					{ id: 'su-th3', title: 'Paint with watercolors', completed: true, emoji: '🎨' }
				]
			},
			{
				dayName: 'Friday',
				date: '07.11.2025',
				tasks: [
					{ id: 'su-f1', title: 'Visit the park', completed: true, emoji: '🌳' },
					{ id: 'su-f2', title: 'Learn a new word in English', completed: true, emoji: '🗣️' },
					{ id: 'su-f3', title: 'Dance party!', completed: true, emoji: '💃' }
				]
			},
			{
				dayName: 'Saturday',
				date: '08.11.2025',
				tasks: [
					{ id: 'su-sa1', title: 'Treasure hunt in the garden', completed: true, emoji: '🗺️' },
					{ id: 'su-sa2', title: 'Make a friendship bracelet', completed: true, emoji: '📿' },
					{ id: 'su-sa3', title: 'Bedtime story pick', completed: false, emoji: '🌙' }
				]
			}
		],
		habits: [
			{ id: 'suh1', name: 'Say please & thank you', emoji: '🌟', days: [true, true, true, true, true, true, true] },
			{ id: 'suh2', name: 'Brush teeth 2x', emoji: '🪥', days: [true, true, true, true, true, false, true] },
			{ id: 'suh3', name: 'Eat my veggies', emoji: '🥦', days: [false, true, true, false, true, true, false] },
			{ id: 'suh4', name: 'Share with siblings', emoji: '🤝', days: [true, true, false, true, true, true, true] },
			{ id: 'suh5', name: 'Nap time', emoji: '😴', days: [true, false, true, true, false, true, true] }
		]
	},
	{
		id: '4',
		name: 'Pedro',
		theme: themes.pedro,
		quote: {
			text: 'To infinity and beyond!',
			author: 'Buzz Lightyear'
		},
		weekStart: '02.11.2025',
		days: [
			{
				dayName: 'Sunday',
				date: '02.11.2025',
				tasks: [
					{ id: 'p-s1', title: 'Build LEGO spaceship', completed: true, emoji: '🧱' },
					{ id: 'p-s2', title: 'Math worksheet - addition', completed: true, emoji: '➕' },
					{ id: 'p-s3', title: 'Read a comic book', completed: true, emoji: '📚' },
					{ id: 'p-s4', title: 'Take out the trash', completed: false, emoji: '🗑️' }
				]
			},
			{
				dayName: 'Monday',
				date: '03.11.2025',
				tasks: [
					{ id: 'p-m1', title: 'Karate practice', completed: true, emoji: '🥋' },
					{ id: 'p-m2', title: 'Science experiment - volcano', completed: true, emoji: '🌋' },
					{ id: 'p-m3', title: 'Write in journal', completed: false, emoji: '📝' },
					{ id: 'p-m4', title: 'Organize my bookshelf', completed: false, emoji: '📚' }
				]
			},
			{
				dayName: 'Tuesday',
				date: '04.11.2025',
				tasks: [
					{ id: 'p-t1', title: 'Basketball at the park', completed: true, emoji: '🏀' },
					{ id: 'p-t2', title: 'Spelling bee practice', completed: true, emoji: '🐝' },
					{ id: 'p-t3', title: 'Fold my laundry', completed: false, emoji: '👕' }
				]
			},
			{
				dayName: 'Wednesday',
				date: '05.11.2025',
				tasks: [
					{ id: 'p-w1', title: 'Coding class online', completed: true, emoji: '💻' },
					{ id: 'p-w2', title: 'Build a cardboard robot', completed: true, emoji: '🤖' },
					{ id: 'p-w3', title: 'Help dad cook dinner', completed: true, emoji: '🍳' }
				]
			},
			{
				dayName: 'Thursday',
				date: '06.11.2025',
				tasks: [
					{ id: 'p-th1', title: 'Geography quiz study', completed: true, emoji: '🌍' },
					{ id: 'p-th2', title: 'Bike ride around the block', completed: true, emoji: '🚴' },
					{ id: 'p-th3', title: 'Clean up after dinner', completed: false, emoji: '🍽️' }
				]
			},
			{
				dayName: 'Friday',
				date: '07.11.2025',
				tasks: [
					{ id: 'p-f1', title: 'Board game night', completed: true, emoji: '🎲' },
					{ id: 'p-f2', title: 'Sketch a superhero', completed: true, emoji: '🦸' },
					{ id: 'p-f3', title: 'Practice guitar 20 min', completed: false, emoji: '🎸' }
				]
			},
			{
				dayName: 'Saturday',
				date: '08.11.2025',
				tasks: [
					{ id: 'p-sa1', title: 'Soccer match at 10am', completed: true, emoji: '⚽' },
					{ id: 'p-sa2', title: 'Watch a documentary', completed: true, emoji: '🎥' },
					{ id: 'p-sa3', title: 'Build a paper airplane', completed: true, emoji: '✈️' },
					{ id: 'p-sa4', title: 'Set the table for dinner', completed: false, emoji: '🍴' }
				]
			}
		],
		habits: [
			{ id: 'ph1', name: 'Make my bed', emoji: '🛏️', days: [true, false, true, true, true, false, true] },
			{ id: 'ph2', name: 'Brush teeth 2x', emoji: '🪥', days: [true, true, true, true, true, true, true] },
			{ id: 'ph3', name: 'Read 15 min', emoji: '📖', days: [true, false, true, false, true, true, false] },
			{ id: 'ph4', name: 'Exercise 30 min', emoji: '💪', days: [false, true, true, true, true, false, true] },
			{ id: 'ph5', name: 'Help with chores', emoji: '🧽', days: [true, true, false, true, false, true, false] },
			{ id: 'ph6', name: 'No arguing', emoji: '✌️', days: [false, true, true, true, false, true, true] }
		]
	}
];

// Helper functions
export function getCompletionPercent(tasks: Task[]): number {
	if (tasks.length === 0) return 0;
	const completed = tasks.filter((t) => t.completed).length;
	return Math.round((completed / tasks.length) * 100);
}

export function getTotalTasks(member: FamilyMember): number {
	return member.days.reduce((sum, day) => sum + day.tasks.length, 0);
}

export function getTotalCompleted(member: FamilyMember): number {
	return member.days.reduce(
		(sum, day) => sum + day.tasks.filter((t) => t.completed).length,
		0
	);
}

export function getHabitProgress(habit: Habit): number {
	const checked = habit.days.filter(Boolean).length;
	return Math.round((checked / 7) * 100);
}

export function getOverallHabitProgress(habits: Habit[]): number {
	const total = habits.length * 7;
	const checked = habits.reduce(
		(sum, h) => sum + h.days.filter(Boolean).length,
		0
	);
	return Math.round((checked / total) * 100);
}

export const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fun completion messages for kids
export function getKidCompletionMessage(percent: number): string {
	if (percent === 100) return 'Perfect! ⭐';
	if (percent >= 80) return 'Amazing! 🎉';
	if (percent >= 60) return 'Great job! 💪';
	if (percent >= 40) return 'Keep going! 🚀';
	if (percent >= 20) return 'Good start! 🌱';
	return "Let's go! 🏁";
}
