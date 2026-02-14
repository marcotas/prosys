<script lang="ts">
  import type { Habit, ThemeConfig } from "$lib/data/fake";
  import { dayAbbreviations, getHabitProgress } from "$lib/data/fake";

  let {
    habits,
    theme,
    onToggleHabit,
    onAddHabit,
    onUpdateHabit,
    onDeleteHabit,
  } = $props<{
    habits: Habit[];
    theme: ThemeConfig;
    onToggleHabit: (habitId: string, dayIndex: number) => void;
    onAddHabit: (name: string, emoji?: string) => void;
    onUpdateHabit: (
      habitId: string,
      updates: { name?: string; emoji?: string },
    ) => void;
    onDeleteHabit: (habitId: string) => void;
  }>();

  let playful = $derived(theme.variant === "playful");
  let hasHabits = $derived(habits.length > 0);

  // Collapsed state
  const STORAGE_KEY = "prosys-habits-collapsed";
  let collapsed = $state(
    typeof window !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "true",
  );

  function toggle() {
    collapsed = !collapsed;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  }

  // Edit habit inline — always an input, track focus state for value management
  let editingHabitId = $state<string | null>(null);
  let editValue = $state("");

  function startEdit(habitId: string, currentName: string) {
    if (swipedOpenId) {
      swipedOpenId = null;
      return;
    }
    editingHabitId = habitId;
    editValue = currentName;
  }

  function commitEdit(habitId: string, originalName: string) {
    const val = editValue.trim();
    if (editingHabitId === habitId && val && val !== originalName) {
      onUpdateHabit(habitId, { name: val });
    }
    editingHabitId = null;
    editValue = "";
  }

  // Add habit — always-visible input at bottom of table
  let newHabitName = $state("");

  function submitNewHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    onAddHabit(name);
    newHabitName = "";
  }

  // Swipe to delete — only on the habit name cell
  const DELETE_ZONE = 64;
  const SWIPE_THRESHOLD = 30;
  let swipedOpenId = $state<string | null>(null);
  let dragState = $state<{
    habitId: string;
    startX: number;
    startY: number;
    currentX: number;
    locked: boolean;
  } | null>(null);

  function getSwipeOffset(habitId: string): number {
    if (dragState && dragState.habitId === habitId && dragState.locked) {
      const raw = dragState.currentX - dragState.startX;
      return Math.max(-DELETE_ZONE, Math.min(0, raw));
    }
    if (swipedOpenId === habitId) return -DELETE_ZONE;
    return 0;
  }

  function onPointerDown(e: PointerEvent, habitId: string) {
    if (e.button !== 0) return;
    if (editingHabitId === habitId) return;
    if (swipedOpenId && swipedOpenId !== habitId) {
      swipedOpenId = null;
    }
    const startOffset = swipedOpenId === habitId ? -DELETE_ZONE : 0;
    dragState = {
      habitId,
      startX: e.clientX - startOffset,
      startY: e.clientY,
      currentX: e.clientX,
      locked: false,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        dragState = null;
        return;
      }
      if (Math.abs(dx) > 5) {
        dragState.locked = true;
      } else {
        return;
      }
    }
    e.preventDefault();
    dragState.currentX = e.clientX;
  }

  function onPointerUp() {
    if (!dragState) return;
    if (dragState.locked) {
      const dx = dragState.currentX - dragState.startX;
      if (dx < -SWIPE_THRESHOLD) {
        swipedOpenId = dragState.habitId;
      } else {
        swipedOpenId = null;
      }
    }
    dragState = null;
  }

  function handleDeleteSwiped(habitId: string) {
    swipedOpenId = null;
    onDeleteHabit(habitId);
  }
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} />

<section
  class="bg-white shadow-sm overflow-hidden
		{playful ? 'rounded-3xl border-2' : 'rounded-2xl border border-gray-200/60'}"
  style={playful ? `border-color: ${theme.accent}25` : ""}
  aria-label="Habit tracker"
>
  <!-- Collapsible Header -->
  <button
    onclick={toggle}
    class="w-full text-white px-4 py-2 flex items-center justify-between cursor-pointer hover:brightness-110 transition-all"
    style="background-color: {theme.headerBg}"
    aria-expanded={!collapsed}
  >
    <h3 class="font-bold text-sm tracking-wide">
      {playful ? `${theme.emoji} Habit Tracker` : "Habit Tracker"}
    </h3>
    <div class="flex items-center gap-2">
      {#if hasHabits}
        <span class="text-xs font-medium opacity-80 tabular-nums">
          {habits.length} habits
        </span>
      {/if}
      <svg
        class="w-4 h-4 transition-transform duration-200 {collapsed
          ? '-rotate-90'
          : ''}"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  </button>

  {#if !collapsed}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr
            class="border-b"
            style="border-color: {playful ? `${theme.accent}12` : '#f3f4f6'}"
          >
            <th
              class="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
              style="color: {playful ? theme.accent : '#9ca3af'}"
            >
              Habit
            </th>
            {#each dayAbbreviations as abbr}
              <th
                class="px-1.5 py-2.5 text-[11px] font-semibold text-center uppercase tracking-wide"
                style="color: {playful ? theme.accent : '#9ca3af'}"
              >
                {abbr}
              </th>
            {/each}
            <th
              class="px-4 py-2.5 text-[11px] font-semibold text-right uppercase tracking-widest whitespace-nowrap"
              style="color: {playful ? theme.accent : '#9ca3af'}"
            >
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          {#each habits as habit (habit.id)}
            {@const progress = getHabitProgress(habit)}
            {@const offset = getSwipeOffset(habit.id)}
            {@const isSwiping =
              dragState?.habitId === habit.id && dragState?.locked}
            {@const isRevealed = offset < 0 || swipedOpenId === habit.id}
            <tr
              class="border-b last:border-b-0 hover:bg-gray-50/40 transition-colors"
              style="border-color: {playful ? `${theme.accent}06` : '#f9fafb'}"
            >
              <!-- Habit name cell — swipeable + always-editable input -->
              <td class="relative overflow-hidden p-0">
                <!-- Delete zone — only render when swiped -->
                {#if isRevealed}
                  <button
                    onclick={() => handleDeleteSwiped(habit.id)}
                    aria-label="Delete {habit.name}"
                    class="absolute inset-y-0 right-0 flex items-center justify-center text-white cursor-pointer"
                    style="width: {DELETE_ZONE}px; background-color: #ef4444"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                {/if}

                <!-- Swipeable name content -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="relative bg-white px-4 py-2 flex items-center {isSwiping
                    ? ''
                    : 'transition-transform duration-200 ease-out'}"
                  style="transform: translateX({offset}px); touch-action: pan-y; z-index: 1;"
                  onpointerdown={(e) => onPointerDown(e, habit.id)}
                >
                  {#if habit.emoji}<span
                      class="mr-1 select-none"
                      aria-hidden="true">{habit.emoji}</span
                    >{/if}
                  <input
                    type="text"
                    value={editingHabitId === habit.id ? editValue : habit.name}
                    oninput={(e) => {
                      editValue = e.currentTarget.value;
                    }}
                    onfocus={(e) => {
                      startEdit(habit.id, habit.name);
                    }}
                    onblur={() => commitEdit(habit.id, habit.name)}
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        editingHabitId = null;
                        editValue = "";
                        e.currentTarget.value = habit.name;
                        e.currentTarget.blur();
                      }
                    }}
                    class="text-[13px] w-full bg-transparent border-none outline-hidden p-0 m-0 whitespace-nowrap focus:outline-hidden {playful
                      ? 'font-medium'
                      : 'text-gray-700'}"
                    aria-label="Habit: {habit.name}"
                  />
                </div>
              </td>

              <!-- Day checkboxes — proper table cells -->
              {#each habit.days as checked, dayIdx}
                <td class="px-1.5 py-1.5 text-center">
                  <button
                    onclick={() => onToggleHabit(habit.id, dayIdx)}
                    role="checkbox"
                    aria-checked={checked}
                    aria-label="{habit.name}, {dayAbbreviations[dayIdx]}"
                    class="w-[26px] h-[26px] rounded-md flex items-center justify-center mx-auto
											transition-all duration-150 hover:scale-110"
                    style={checked
                      ? `background-color: ${theme.checkColor}; color: white`
                      : `background-color: ${playful ? `${theme.accent}08` : "#f5f5f5"}`}
                  >
                    {#if checked}
                      {#if playful}
                        <span class="text-[10px]" aria-hidden="true">⭐</span>
                      {:else}
                        <svg
                          class="w-3 h-3"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      {/if}
                    {/if}
                  </button>
                </td>
              {/each}

              <!-- Progress cell -->
              <td class="px-4 py-2 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div
                    class="w-20 h-[5px] rounded-full overflow-hidden"
                    style="background-color: {progress === 100
                      ? `${theme.accent}30`
                      : playful
                        ? `${theme.accent}15`
                        : '#f0f0f0'}"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="{habit.name} progress"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      style="width: {progress}%; background-color: {theme.accent}"
                    ></div>
                  </div>
                  {#if progress === 100}
                    <span
                      class="text-sm w-9 text-right"
                      aria-label="100% complete">🏆</span
                    >
                  {:else}
                    <span
                      class="text-xs font-semibold w-9 text-right tabular-nums"
                      style="color: {playful ? theme.accent : '#6b7280'}"
                    >
                      {progress}%
                    </span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}

          <!-- Add habit row — always visible inline input -->
          <tr>
            <td colspan="9" class="px-4 py-2">
              <input
                type="text"
                bind:value={newHabitName}
                placeholder={playful ? "Add habit ✨" : "+ Add habit"}
                onkeydown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewHabit();
                  } else if (e.key === "Escape") {
                    newHabitName = "";
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                class="text-[13px] w-full bg-transparent border-none outline-hidden focus-visible:outline-hidden p-0 m-0 placeholder:text-gray-300 focus:outline-hidden {playful
                  ? 'font-medium placeholder:opacity-60'
                  : 'text-gray-700'}"
                style={playful ? `color: ${theme.accentDark}` : ""}
                aria-label="Add new habit"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    {#if !hasHabits}
      <div
        class="flex flex-col items-center justify-center py-6 text-center px-4"
      >
        <span class="text-2xl mb-2" aria-hidden="true"
          >{playful ? "🌈" : "📊"}</span
        >
        <p
          class="text-sm font-medium"
          style="color: {playful ? theme.accent : '#9ca3af'}"
        >
          {playful ? "No habits yet!" : "No habits tracked"}
        </p>
        <p class="text-xs mt-1 text-gray-400">
          Type a name above to start tracking
        </p>
      </div>
    {/if}
  {/if}
</section>
