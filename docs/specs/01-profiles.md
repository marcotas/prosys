# Family Profiles

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/lib/stores/members.svelte.ts`, `src/lib/components/FamilySwitcher.svelte`, `src/lib/components/ProfileDialog.svelte`, `src/lib/components/ThemePicker.svelte`, `src/routes/api/members/+server.ts`, `src/routes/api/members/[id]/+server.ts`
- **Interfaces exposed**: `memberStore` — reactive store with `members` array, `selectedMemberId`, and methods (`load`, `create`, `update`, `delete`, `select`)
- **Interfaces consumed**: `Member`, `ThemeConfig` types from setup; DB connection + schema

## Description

Build the family member profile management end-to-end:

1. **API routes** — `GET /api/members` returns all members. `POST /api/members` creates a member with default theme. `PATCH /api/members/[id]` updates name/theme/quote. `DELETE /api/members/[id]` cascades to tasks and habits.

2. **Store** — `members.svelte.ts` holds the reactive member list. `load()` fetches from API on mount. Mutations call the API then update local state optimistically.

3. **Components** — Port `FamilySwitcher`, `ProfileDialog`, and `ThemePicker` from the prototype. Replace fake data with store reads. Wire mutations to store methods.

4. **Seed data** — If the DB is empty on first load, seed with the 4 sample members from the prototype (Marco, Alice, Susana, Pedro) so the app isn't blank.

## Acceptance Criteria

- Can create a new family member with name, theme, and quote
- Can edit an existing member's name, theme, and quote
- Can delete a member (with confirmation)
- Switching members updates the selected profile instantly
- Member data persists across page reloads (stored in SQLite)
- Deleting a member removes their tasks and habits from the DB
