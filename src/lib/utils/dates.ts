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
export function dateToISO(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

// Keep internal alias for backward compat within this file
const toISO = dateToISO;

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
	return dateToISO(getSundayForOffset(weekOffset));
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
 * Parse an ISO date string (YYYY-MM-DD) to a local Date without timezone issues.
 */
export function isoToDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Get the ISO Sunday (week start) for any given date.
 */
export function getWeekStartForDate(d: Date): string {
	const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	copy.setDate(copy.getDate() - copy.getDay());
	return dateToISO(copy);
}

/**
 * Human-readable month label, e.g. "February 2026".
 */
export function monthLabel(year: number, month: number): string {
	const FULL_MONTHS = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	return `${FULL_MONTHS[month]} ${year}`;
}

/**
 * Generate a 6×7 grid for a month calendar (weeks start Sunday).
 * Returns array of 6 rows, each with 7 cells (Date or null for empty cells).
 */
export function getMonthGrid(year: number, month: number): (Date | null)[][] {
	const firstDay = new Date(year, month, 1);
	const startDow = firstDay.getDay(); // 0=Sun
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const grid: (Date | null)[][] = [];
	let day = 1 - startDow; // may be negative (empty cells before month starts)

	for (let row = 0; row < 6; row++) {
		const week: (Date | null)[] = [];
		for (let col = 0; col < 7; col++) {
			if (day >= 1 && day <= daysInMonth) {
				week.push(new Date(year, month, day));
			} else {
				week.push(null);
			}
			day++;
		}
		grid.push(week);
	}
	return grid;
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
