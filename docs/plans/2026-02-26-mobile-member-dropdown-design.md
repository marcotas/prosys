# Mobile Member Dropdown — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the horizontal member badge row with a Popover dropdown on mobile (< 768px) so members are identifiable by name, not just initials.

**Architecture:** Use bits-ui `Popover` (not `Select`) to match the existing codebase pattern in `AssignPicker.svelte`. Mobile variant detected via `matchMedia` reactive state. Both mobile (Popover dropdown) and desktop (horizontal scroll row) render in the same component, toggled by `isMobile`.

**Tech Stack:** Svelte 5 runes, bits-ui `Popover`, Tailwind CSS 4

---

### Task 1: Add mobile detection and Popover import to FamilySwitcher

**Files:**
- Modify: `src/lib/components/FamilySwitcher.svelte`

**Step 1: Add imports and mobile detection state**

In the `<script>` block, add the Popover import and `isMobile` reactive state using the same `matchMedia` pattern from `AssignPicker.svelte`:

```svelte
<script lang="ts">
	import type { Member } from '$lib/types';
	import { Popover } from 'bits-ui';

	let { members, selectedId, onSelect, onAdd, onEdit } = $props<{
		members: Member[];
		selectedId: string;
		onSelect: (id: string) => void;
		onAdd: () => void;
		onEdit: (member: Member) => void;
	}>();

	let isFamilySelected = $derived(selectedId === '__family__');
	let selectedMember = $derived(members.find((m) => m.id === selectedId));

	let isMobile = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});
</script>
```

Key additions:
- `import { Popover } from 'bits-ui'`
- `selectedMember` derived from `members` and `selectedId`
- `isMobile` state with `matchMedia` `$effect` (same pattern as `AssignPicker.svelte:20-26`)

**Step 2: Verify the script compiles**

Run: `pnpm build`
Expected: Build succeeds (new state/derived are unused but valid)

---

### Task 2: Add the mobile Popover dropdown variant

**Files:**
- Modify: `src/lib/components/FamilySwitcher.svelte`

**Step 1: Wrap existing `<nav>` in conditional and add mobile variant**

Replace the template with an `{#if isMobile}` / `{:else}` block. The mobile variant renders:

1. Family badge button (standalone, same as current)
2. Separator
3. Popover with trigger (selected member badge + truncated name + chevron) and content (member list + add button)
4. Note: on mobile, the standalone Add button is removed since it lives inside the dropdown

```svelte
{#if isMobile}
	<!-- Mobile: compact dropdown -->
	<nav aria-label="Family members" class="flex items-center gap-1.5 pt-2 pb-1 -mt-2 -mb-1 pr-1">
		<!-- Family / Planner button (badge only) -->
		<div class="shrink-0">
			<a
				href={isFamilySelected ? '/' : '/planner'}
				onclick={(e) => {
					if (isFamilySelected) return;
					e.preventDefault();
					onSelect('__family__');
				}}
				aria-current={isFamilySelected ? 'true' : undefined}
				aria-label="Family planner"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
					focus-visible:ring-2 focus-visible:ring-offset-1
					{isFamilySelected
					? 'shadow-sm border-2'
					: 'border-2 border-transparent hover:bg-white/60'}"
				style={isFamilySelected
					? 'background-color: #eef2ff; border-color: #6366f140; color: #312e81; --tw-ring-color: #6366f1'
					: 'color: #6b7280; --tw-ring-color: #6366f1'}
			>
				<span
					class="flex items-center justify-center text-white text-xs font-bold w-7 h-7 rounded-full
						{isFamilySelected ? 'scale-110' : ''}"
					style="background-color: #6366f1"
					aria-hidden="true"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round" />
						<polyline points="9 22 9 12 15 12 15 22" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
			</a>
		</div>

		<!-- Separator -->
		<div class="w-px h-6 bg-gray-200 shrink-0" aria-hidden="true"></div>

		<!-- Member dropdown -->
		{#if selectedMember && !isFamilySelected}
			{@const isPlayful = selectedMember.theme.variant === 'playful'}
			<Popover.Root>
				<Popover.Trigger
					class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
						shadow-sm border-2 focus-visible:ring-2 focus-visible:ring-offset-1 cursor-pointer"
					style="background-color: {selectedMember.theme.accentLight}; border-color: {selectedMember.theme.accent}40; color: {selectedMember.theme.accentDark}; --tw-ring-color: {selectedMember.theme.accent}"
				>
					<span
						class="flex items-center justify-center text-white text-xs font-bold shrink-0
							{isPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'} scale-110"
						style="background-color: {selectedMember.theme.accent}"
						aria-hidden="true"
					>
						{#if isPlayful && selectedMember.theme.emoji}
							{selectedMember.theme.emoji}
						{:else}
							{selectedMember.name.charAt(0)}
						{/if}
					</span>
					<span class="truncate max-w-[10ch]">{selectedMember.name}</span>
					<!-- Chevron down -->
					<svg class="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
						<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</Popover.Trigger>

				<Popover.Portal>
					<Popover.Content
						class="z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[200px]
							data-[state=open]:animate-[popIn_150ms_ease-out]"
						sideOffset={4}
						align="start"
					>
						{#each members as member (member.id)}
							{@const isSelected = selectedId === member.id}
							{@const memberPlayful = member.theme.variant === 'playful'}
							<button
								onclick={() => onSelect(member.id)}
								class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors
									{isSelected ? 'font-semibold' : 'text-gray-700'}"
							>
								<span
									class="flex items-center justify-center text-white text-xs font-bold shrink-0
										{memberPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'}"
									style="background-color: {member.theme.accent}"
									aria-hidden="true"
								>
									{#if memberPlayful && member.theme.emoji}
										{member.theme.emoji}
									{:else}
										{member.name.charAt(0)}
									{/if}
								</span>
								<span class="truncate">{member.name}</span>
								{#if isSelected}
									<svg class="w-3.5 h-3.5 ml-auto text-green-500 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
										<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{/if}
							</button>
						{/each}

						<!-- Divider + Add Profile -->
						<div class="border-t border-gray-100 mt-1 pt-1">
							<button
								onclick={onAdd}
								class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
							>
								<span class="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
									<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
										<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</span>
								<span>Add Profile</span>
							</button>
						</div>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		{:else if isFamilySelected}
			<!-- When family is selected, still show a member switcher trigger -->
			<Popover.Root>
				<Popover.Trigger
					class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
						border-2 border-transparent hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-offset-1 cursor-pointer text-gray-500"
				>
					<span class="text-xs">Members</span>
					<svg class="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
						<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</Popover.Trigger>

				<Popover.Portal>
					<Popover.Content
						class="z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[200px]
							data-[state=open]:animate-[popIn_150ms_ease-out]"
						sideOffset={4}
						align="start"
					>
						{#each members as member (member.id)}
							{@const isSelected = selectedId === member.id}
							{@const memberPlayful = member.theme.variant === 'playful'}
							<button
								onclick={() => onSelect(member.id)}
								class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors
									{isSelected ? 'font-semibold' : 'text-gray-700'}"
							>
								<span
									class="flex items-center justify-center text-white text-xs font-bold shrink-0
										{memberPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'}"
									style="background-color: {member.theme.accent}"
									aria-hidden="true"
								>
									{#if memberPlayful && member.theme.emoji}
										{member.theme.emoji}
									{:else}
										{member.name.charAt(0)}
									{/if}
								</span>
								<span class="truncate">{member.name}</span>
								{#if isSelected}
									<svg class="w-3.5 h-3.5 ml-auto text-green-500 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
										<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{/if}
							</button>
						{/each}

						<div class="border-t border-gray-100 mt-1 pt-1">
							<button
								onclick={onAdd}
								class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
							>
								<span class="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
									<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
										<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</span>
								<span>Add Profile</span>
							</button>
						</div>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		{/if}
	</nav>
{:else}
	<!-- Desktop: existing horizontal scroll row (unchanged) -->
	<existing desktop nav — keep as-is>
{/if}
```

Note: The `{:else}` branch contains the **exact existing** `<nav>` element from the current `FamilySwitcher.svelte` with zero changes. The edit button hover behavior (`group-hover:opacity-100`) continues to work only on desktop.

**Step 2: Add the popIn keyframe animation**

Add a `<style>` block if not already present (matching `AssignPicker.svelte`):

```svelte
<style>
	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Build succeeds with no errors

---

### Task 3: Visual verification

**Step 1: Start dev server and test mobile view**

Run: `pnpm dev`

Test at < 768px width:
- Family badge shows on the left
- Dropdown trigger shows selected member badge + truncated name + chevron
- Tapping trigger opens Popover with all members (badge + full name)
- Selected member has a checkmark
- "Add Profile" appears below a divider
- Selecting a member switches profile and closes the dropdown

Test at >= 768px:
- Original horizontal scroll row displays unchanged
- Edit buttons appear on hover
- "Add" button visible with label on sm+

**Step 2: Commit**

```bash
git add src/lib/components/FamilySwitcher.svelte
git commit -m "feat: mobile member dropdown for better profile identification"
```
