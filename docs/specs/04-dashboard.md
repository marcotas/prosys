# Dashboard

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/lib/components/OverallProgress.svelte`, `src/lib/components/WeeklyBarChart.svelte`, `src/lib/components/WeekNavigator.svelte`
- **Interfaces exposed**: The main page that composes all features into a single dashboard view
- **Interfaces consumed**: `Member`, `Task`, `DayData`, `HabitWithDays`, `ThemeConfig` types from setup; `memberStore` from 01; `taskStore` from 02; `habitStore` from 03; date utils

## Description

Build the main dashboard page that assembles all features:

1. **Server load** — `+page.server.ts` loads the initial data for the default member's current week (members list, tasks, habits + completions) so the page renders with data on first paint (SSR).

2. **Week navigation** — Port `WeekNavigator` from prototype. Previous/next week buttons and "Today" button. When week changes, triggers `taskStore.loadWeek()` and `habitStore.loadWeek()` for the new week.

3. **Overall progress** — Port `OverallProgress` and `WeeklyBarChart` from prototype. Reads from `taskStore.weekTasks` to compute totals and per-day completion for the current week. Collapsible card with bar chart, progress ring, and motivational quote.

4. **Page layout** — Header with member name/emoji + FamilySwitcher. Below: WeekNavigator. Below: 2-column grid (OverallProgress left, HabitTracker right). Below: 7-column day card grid. Responsive breakpoints match the prototype.

5. **Member switching** — When `selectedMemberId` changes, reload tasks and habits for the new member's current week.

## Acceptance Criteria

- Page loads with data (no blank flash — SSR works)
- Week navigator shows correct date range (e.g. "Feb 8 – 14, 2026")
- Previous/next week buttons load that week's tasks and habits
- "Today" button returns to the current week
- Overall progress bar chart reflects the visible week's task data
- Progress ring shows correct overall completion percentage
- Switching family members loads that member's data
- Responsive layout: 7 columns on XL, 4 on LG, 3 on MD, 2 on SM, 1 on mobile
