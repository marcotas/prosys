# Integration

- **Type**: integration
- **Depends on**: 00-setup, 01-profiles, 02-tasks, 03-habits, 04-dashboard, 05-drag-drop, 06-realtime, 07-platform
- **Files owned**: Any file that needs cross-feature wiring (modifications only, not creation)
- **Interfaces exposed**: Fully wired application
- **Interfaces consumed**: Everything from all tasks

## Description

Wire all features together, resolve conflicts, and verify end-to-end:

### 1. Drag handles into existing components
- Add `DragHandle` (from 05) to each task row in `DayCard.svelte` (from 02)
- Add `DragHandle` to each habit row in `HabitTracker.svelte` (from 03)
- Wire the sortable action for within-day task reorder and habit reorder
- Wire cross-day task drag on the dashboard page (from 04)
- Add "Move to..." option in the swipe-reveal menu for mobile cross-day moves

### 2. WebSocket integration into stores
- Wire `wsStore` message handlers into `memberStore` (from 01)
- Wire `wsStore` message handlers into `taskStore` (from 02)
- Wire `wsStore` message handlers into `habitStore` (from 03)
- Add `wsServer.broadcast()` calls to all API routes (from 01, 02, 03, 05)

### 3. Dashboard composition
- Verify `+page.svelte` correctly imports and renders all feature components
- Verify SSR load function provides all initial data
- Verify member switching reloads all stores
- Verify week navigation reloads tasks and habits

### 4. Platform verification
- Verify Tauri sidecar correctly starts/stops the SvelteKit server
- Verify LAN access works (test from another device)
- Verify mDNS discovery works
- Verify PWA install and standalone mode

### 5. Polish and conflict resolution
- Fix any broken imports or type mismatches
- Resolve any CSS conflicts between components
- Ensure all error states are handled (empty states, loading, API failures)
- Verify no console errors in development mode

## Acceptance Criteria

- Create a member → appears on another tab in real-time
- Add a task on Monday → shows on another tab, progress updates
- Toggle a habit → syncs to another tab
- Drag-reorder tasks within a day → order persists, syncs to other tabs
- Drag a task from Monday to Wednesday (desktop) → task moves, both days update
- "Move to..." (mobile) → task moves to selected day
- Reorder habits → order persists, syncs to other tabs
- Navigate weeks → tasks and habits load for the selected week
- Switch members → all data refreshes for the new member
- Tauri app launches, shows dashboard, accessible from phone on LAN
- PWA installs on iOS with correct icon
- No console errors, no visual regressions vs. prototype
