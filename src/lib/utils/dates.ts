// Week date computation utilities.
// weekOffset: 0 = current week, -1 = last week, +1 = next week.
// Weeks start on Sunday.

export const dayNames = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];
export const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Get the Sunday of the current week (local time).
 * Uses setDate to avoid DST issues — never do millisecond math across DST boundaries.
 */
function getCurrentSunday(): Date {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay(); // 0 = Sunday
	today.setDate(today.getDate() - dayOfWeek);
	return today;
}

/**
 * Get a Date for the Sunday of the week at the given offset from the current week.
 */
function getSundayForOffset(weekOffset: number): Date {
	const sunday = getCurrentSunday();
	sunday.setDate(sunday.getDate() + weekOffset * 7);
	return sunday;
}

/**
 * Format a Date as ISO date string YYYY-MM-DD.
 */
function toISO(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date as DD.MM.YYYY for display.
 */
function toDMY(d: Date): string {
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the Sunday for the given week offset.
 * weekOffset=0 → this week's Sunday.
 */
export function getWeekStart(weekOffset: number): string {
	return toISO(getSundayForOffset(weekOffset));
}

/**
 * Returns 7 day objects for the week at the given offset.
 */
export function computeWeekDays(
	weekOffset: number
): { dayName: string; date: string; isoDate: string }[] {
	const sunday = getSundayForOffset(weekOffset);
	const days: { dayName: string; date: string; isoDate: string }[] = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
		days.push({
			dayName: dayNames[d.getDay()],
			date: toDMY(d),
			isoDate: toISO(d)
		});
	}
	return days;
}

/**
 * Returns the week offset for a given ISO date relative to today's week.
 * For example, if weekStart is last Sunday, returns -1.
 */
export function weekOffsetFromISO(isoDate: string): number {
	const [y, m, d] = isoDate.split('-').map(Number);
	const target = new Date(y, m - 1, d);
	const current = getCurrentSunday();
	const diffMs = target.getTime() - current.getTime();
	const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
	return Math.round(diffDays / 7);
}

/**
 * Returns 0. Current week offset is always 0 by definition.
 * Kept for API compatibility with the prototype.
 */
export function getTodayWeekOffset(): number {
	return 0;
}

/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 */
export function getTodayISO(): string {
	const now = new Date();
	return toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Human-readable date range string for a week, e.g. "Feb 8 – 14, 2026".
 */
export function formatWeekRange(weekOffset: number): string {
	const sunday = getSundayForOffset(weekOffset);
	const saturday = new Date(
		sunday.getFullYear(),
		sunday.getMonth(),
		sunday.getDate() + 6
	);
	const sm = MONTHS[sunday.getMonth()];
	const em = MONTHS[saturday.getMonth()];
	if (sunday.getMonth() === saturday.getMonth()) {
		return `${sm} ${sunday.getDate()} – ${saturday.getDate()}, ${sunday.getFullYear()}`;
	}
	if (sunday.getFullYear() === saturday.getFullYear()) {
		return `${sm} ${sunday.getDate()} – ${em} ${saturday.getDate()}, ${sunday.getFullYear()}`;
	}
	return `${sm} ${sunday.getDate()}, ${sunday.getFullYear()} – ${em} ${saturday.getDate()}, ${saturday.getFullYear()}`;
}
