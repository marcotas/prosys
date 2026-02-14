# Data Model

## Entity Relationship Diagram

```
family_members 1──* tasks
family_members 1──* habits
habits         1──* habit_completions
```

Tasks and habit completions are scoped to a **week** (via `week_start`), enabling per-week views without loading all data.

## Tables

### family_members

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | nanoid |
| name | TEXT | NOT NULL | Display name |
| theme_variant | TEXT | NOT NULL DEFAULT 'default' | 'default' or 'playful' |
| theme_accent | TEXT | NOT NULL | Hex color |
| theme_accent_light | TEXT | NOT NULL | Hex color |
| theme_accent_dark | TEXT | NOT NULL | Hex color |
| theme_header_bg | TEXT | NOT NULL | Hex color |
| theme_ring_color | TEXT | NOT NULL | Hex color |
| theme_check_color | TEXT | NOT NULL | Hex color |
| theme_emoji | TEXT | NOT NULL DEFAULT '' | For playful variant |
| quote_text | TEXT | NOT NULL DEFAULT '' | Motivational quote |
| quote_author | TEXT | NOT NULL DEFAULT '' | Quote attribution |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

### tasks

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | nanoid |
| member_id | TEXT | NOT NULL, FK → family_members.id ON DELETE CASCADE | |
| week_start | TEXT | NOT NULL | ISO date of week's Sunday (e.g. '2026-02-08') |
| day_index | INTEGER | NOT NULL, CHECK(0..6) | 0=Sun, 6=Sat |
| title | TEXT | NOT NULL | |
| emoji | TEXT | | Optional emoji prefix |
| completed | INTEGER | NOT NULL DEFAULT 0 | 0 or 1 |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Within-day ordering |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**Indexes:** `(member_id, week_start, day_index)` for fast weekly queries.

### habits

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | nanoid |
| member_id | TEXT | NOT NULL, FK → family_members.id ON DELETE CASCADE | |
| name | TEXT | NOT NULL | |
| emoji | TEXT | | Optional emoji prefix |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Display ordering |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**Indexes:** `(member_id, sort_order)` for ordered listing.

### habit_completions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | nanoid |
| habit_id | TEXT | NOT NULL, FK → habits.id ON DELETE CASCADE | |
| week_start | TEXT | NOT NULL | ISO date of week's Sunday |
| day_index | INTEGER | NOT NULL, CHECK(0..6) | 0=Sun, 6=Sat |
| completed | INTEGER | NOT NULL DEFAULT 1 | Always 1 (row exists = completed) |

**Unique constraint:** `(habit_id, week_start, day_index)` — presence of row means checked.

**Indexes:** `(habit_id, week_start)` for weekly habit view.

## Shared TypeScript Types

These live in `src/lib/types.ts` (created by the setup task, read-only for features):

```typescript
// Theme
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

// Family member
export interface Member {
  id: string;
  name: string;
  theme: ThemeConfig;
  quote: { text: string; author: string };
  createdAt: string;
  updatedAt: string;
}

// Task
export interface Task {
  id: string;
  memberId: string;
  weekStart: string;
  dayIndex: number; // 0-6
  title: string;
  emoji?: string;
  completed: boolean;
  sortOrder: number;
}

// Day view (derived, not stored)
export interface DayData {
  dayName: string;
  date: string;       // DD.MM.YYYY display format
  isoDate: string;    // YYYY-MM-DD for API
  tasks: Task[];
}

// Habit definition
export interface Habit {
  id: string;
  memberId: string;
  name: string;
  emoji?: string;
  sortOrder: number;
}

// Habit with per-week completion (derived for UI)
export interface HabitWithDays extends Habit {
  days: boolean[]; // 7 booleans for Sun-Sat
}

// WebSocket message types
export type WSMessage =
  | { type: 'task:created'; payload: Task }
  | { type: 'task:updated'; payload: Task }
  | { type: 'task:deleted'; payload: { id: string; memberId: string; weekStart: string; dayIndex: number } }
  | { type: 'task:reordered'; payload: { memberId: string; weekStart: string; dayIndex: number; taskIds: string[] } }
  | { type: 'task:moved'; payload: { task: Task; fromDay: number } }
  | { type: 'habit:created'; payload: Habit }
  | { type: 'habit:updated'; payload: Habit }
  | { type: 'habit:deleted'; payload: { id: string; memberId: string } }
  | { type: 'habit:reordered'; payload: { memberId: string; habitIds: string[] } }
  | { type: 'habit:toggled'; payload: { habitId: string; weekStart: string; dayIndex: number; completed: boolean } }
  | { type: 'member:created'; payload: Member }
  | { type: 'member:updated'; payload: Member }
  | { type: 'member:deleted'; payload: { id: string } };
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/members | List all members |
| POST | /api/members | Create member |
| PATCH | /api/members/[id] | Update member |
| DELETE | /api/members/[id] | Delete member |
| GET | /api/members/[id]/tasks?week=YYYY-MM-DD | Get tasks for a week |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/[id] | Update task (title, emoji, completed, dayIndex, sortOrder) |
| DELETE | /api/tasks/[id] | Delete task |
| PUT | /api/tasks/reorder | Batch reorder `{ memberId, weekStart, dayIndex, taskIds[] }` |
| GET | /api/members/[id]/habits | Get habits + completions for a week |
| POST | /api/habits | Create habit |
| PATCH | /api/habits/[id] | Update habit (name, emoji, sortOrder) |
| DELETE | /api/habits/[id] | Delete habit |
| PUT | /api/habits/reorder | Batch reorder `{ memberId, habitIds[] }` |
| PUT | /api/habits/[id]/toggle | Toggle completion `{ weekStart, dayIndex }` |
