<script lang="ts">
  import type { Member, ThemeConfig, DayData } from "$lib/types";
  import { untrack } from "svelte";
  import {
    computeWeekDays,
    getWeekStart,
    getTodayWeekOffset,
    getTodayISO,
  } from "$lib/utils/dates";
  import { memberStore } from "$lib/stores/members.svelte";
  import { taskStore } from "$lib/stores/tasks.svelte";
  import { habitStore } from "$lib/stores/habits.svelte";
  import { wsStore } from "$lib/stores/ws.svelte";
  import FamilySwitcher from "$lib/components/FamilySwitcher.svelte";
  import WeekNavigator from "$lib/components/WeekNavigator.svelte";
  import OverallProgress from "$lib/components/OverallProgress.svelte";
  import HabitTracker from "$lib/components/HabitTracker.svelte";
  import DayCard from "$lib/components/DayCard.svelte";
  import ProfileDialog from "$lib/components/ProfileDialog.svelte";

  // SSR data from +page.server.ts
  let { data } = $props();

  // Hydrate stores on the client with server data (skips if already cached)
  $effect(() => {
    if (data.members.length > 0) {
      untrack(() => {
        memberStore.hydrate(data.members, data.defaultMemberId);
        taskStore.hydrateWeek(data.defaultMemberId, data.weekStart, data.tasks);
        habitStore.hydrateWeek(
          data.defaultMemberId,
          data.weekStart,
          data.habits,
        );
      });
    }
  });

  let dialogOpen = $state(false);
  let editingMember = $state<Member | null>(null);
  let weekOffset = $state(getTodayWeekOffset());

  // currentMember: use store value (CSR) with data fallback (SSR)
  let currentMember = $derived(
    memberStore.selectedMember ??
      data.members.find((m: Member) => m.id === data.defaultMemberId),
  );
  let playful = $derived(currentMember?.theme.variant === "playful");

  // Week navigation state
  let todayOffset = $derived(getTodayWeekOffset());
  let isTodayWeek = $derived(weekOffset === todayOffset);
  let currentWeekStart = $derived(getWeekStart(weekOffset));
  let todayISO = $derived(getTodayISO());

  // Scroll container for day cards
  let scrollContainer = $state<HTMLDivElement>(undefined as unknown as HTMLDivElement);

  // Auto-scroll to today's card
  $effect(() => {
    if (!scrollContainer || !isTodayWeek) return;
    const todayCard = scrollContainer.querySelector(
      `[data-iso="${todayISO}"]`,
    );
    if (todayCard) {
      requestAnimationFrame(() => {
        todayCard.scrollIntoView({ inline: "center", behavior: "instant" });
      });
    }
  });

  // Mouse drag-to-scroll (Linear-style)
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragScrollLeft = 0;

  function onDragPointerDown(e: PointerEvent) {
    // Only handle primary button on non-touch devices
    if (e.pointerType === "touch" || e.button !== 0) return;
    // Don't hijack clicks on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, [contenteditable], [draggable]"))
      return;
    isDragging = true;
    dragStartX = e.clientX;
    dragScrollLeft = scrollContainer.scrollLeft;
    scrollContainer.classList.add("is-dragging");
    scrollContainer.style.cursor = "grabbing";
    scrollContainer.style.userSelect = "none";
    scrollContainer.setPointerCapture(e.pointerId);
  }

  function onDragPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    scrollContainer.scrollLeft = dragScrollLeft - dx;
  }

  function onDragPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    scrollContainer.classList.remove("is-dragging");
    scrollContainer.style.cursor = "";
    scrollContainer.style.userSelect = "";
  }

  // ── Load tasks when member or week changes ──
  $effect(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    if (memberId) {
      taskStore.loadWeek(memberId, weekStart);
    }
  });

  // ── Load habits when member or week changes ──
  $effect(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    if (memberId) {
      habitStore.loadWeek(memberId, weekStart);
    }
  });

  // ── Register sync callback for offline queue drain ──
  // Re-registers whenever member or week changes so we refresh the right data
  $effect(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    if (!memberId) return;

    return wsStore.onSync(async () => {
      await memberStore.load();
      await taskStore.reloadWeek(memberId, weekStart);
      await habitStore.reloadWeek(memberId, weekStart);
    });
  });

  // ── Week data with tasks from store (SSR fallback via data prop) ──
  let visibleDays = $derived.by(() => {
    const memberId = memberStore.selectedMemberId || data.defaultMemberId;
    const weekStart = currentWeekStart;
    // Build day shells, attach tasks from store (or SSR data for initial render)
    const storeTasks = memberId
      ? computeWeekDays(weekOffset).map((d, i) => ({
          dayName: d.dayName,
          date: d.date,
          isoDate: d.isoDate,
          tasks: taskStore.getTasksForDay(memberId, weekStart, i),
        }))
      : null;
    // If store has tasks loaded, use them; otherwise fall back to SSR data
    const hasStoreTasks = storeTasks?.some((d) => d.tasks.length > 0) || false;
    if (hasStoreTasks || memberStore.selectedMemberId) {
      return storeTasks!;
    }
    // SSR fallback: build days from server-loaded tasks
    return computeWeekDays(weekOffset).map((d, i) => ({
      dayName: d.dayName,
      date: d.date,
      isoDate: d.isoDate,
      tasks: data.tasks.filter((t: { dayIndex: number }) => t.dayIndex === i),
    }));
  });

  // ── Habit data from store (SSR fallback via data prop) ──
  let visibleHabits = $derived.by(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    if (memberId) {
      return habitStore.getHabitsWithDays(memberId, weekStart);
    }
    // SSR fallback
    return data.habits;
  });

  // Task operations — wired to task store
  function toggleTask(_dayIndex: number, taskId: string) {
    taskStore.toggle(taskId);
  }
  function addTask(dayIndex: number, title: string, emoji?: string) {
    const memberId = memberStore.selectedMemberId;
    if (!memberId) return;
    taskStore.create({
      memberId,
      weekStart: currentWeekStart,
      dayIndex,
      title,
      emoji,
    });
  }
  function deleteTask(_dayIndex: number, taskId: string) {
    taskStore.delete(taskId);
  }
  function updateTask(
    _dayIndex: number,
    taskId: string,
    updates: { title?: string; emoji?: string },
  ) {
    taskStore.update(taskId, updates);
  }

  // Habit operations — wired to habit store
  function toggleHabit(habitId: string, dayIndex: number) {
    habitStore.toggle(habitId, currentWeekStart, dayIndex);
  }
  function addHabit(name: string, emoji?: string) {
    const memberId = memberStore.selectedMemberId;
    if (!memberId) return;
    habitStore.create(memberId, name, emoji);
  }
  function updateHabit(
    habitId: string,
    updates: { name?: string; emoji?: string },
  ) {
    habitStore.update(habitId, updates);
  }
  function deleteHabit(habitId: string) {
    habitStore.delete(habitId);
  }

  // ── Reorder operations (drag & drop) ──

  function reorderTasks(dayIndex: number, taskIds: string[]) {
    const memberId = memberStore.selectedMemberId;
    if (!memberId) return;
    taskStore.reorder(memberId, currentWeekStart, dayIndex, taskIds);
  }

  async function moveTask(
    taskId: string,
    toDayIndex: number,
    orderedTaskIds: string[],
  ) {
    const memberId = memberStore.selectedMemberId;
    await taskStore.moveToDay(taskId, toDayIndex);
    // If we have the drop-position order, reorder so the task lands where it was dropped
    if (memberId && orderedTaskIds.length > 0) {
      await taskStore.reorder(
        memberId,
        currentWeekStart,
        toDayIndex,
        orderedTaskIds,
      );
    }
  }

  function reorderHabits(habitIds: string[]) {
    const memberId = memberStore.selectedMemberId;
    if (!memberId) return;
    habitStore.reorder(memberId, habitIds);
  }

  // ── Profile dialog handlers ──

  function openCreateDialog() {
    editingMember = null;
    dialogOpen = true;
  }

  function openEditDialog(member: Member) {
    editingMember = member;
    dialogOpen = true;
  }

  async function handleSave(data: {
    name: string;
    theme: ThemeConfig;
    quote: { text: string; author: string };
  }) {
    if (editingMember) {
      await memberStore.update(editingMember.id, data);
    } else {
      await memberStore.create(data);
    }
  }

  async function handleDelete(id: string) {
    await memberStore.delete(id);
  }
</script>

{#if currentMember}
  <div
    class="min-h-screen transition-colors duration-300"
    style={playful
      ? `background-color: ${currentMember.theme.accentLight}30`
      : ""}
  >
    <!-- Contained section: header, nav, stats -->
    <div class="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
      <!-- Header -->
      <header
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300"
            style="background-color: {currentMember.theme.accent}"
            aria-hidden="true"
          >
            {#if playful}
              <span class="text-lg">{currentMember.theme.emoji}</span>
            {:else}
              <svg
                class="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M9 14l2 2 4-4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {/if}
          </div>
          <div>
            <h1
              class="text-2xl font-bold leading-tight transition-colors duration-300"
              style="color: {playful
                ? currentMember.theme.accentDark
                : '#111827'}"
            >
              {playful ? `${currentMember.name}'s Week` : "ProSys"}
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <FamilySwitcher
            members={memberStore.members.length > 0
              ? memberStore.members
              : data.members}
            selectedId={memberStore.selectedMemberId || data.defaultMemberId}
            onSelect={(id) => memberStore.select(id)}
            onAdd={openCreateDialog}
            onEdit={openEditDialog}
          />
          <a
            href="/connect"
            class="flex items-center justify-center w-9 h-9 rounded-lg
              bg-white border border-gray-200 text-gray-400 hover:text-green-600
              hover:border-green-300 transition-colors shadow-sm"
            title="Connect a device"
          >
            <svg
              class="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="2" width="8" height="8" rx="1" />
              <rect x="14" y="2" width="8" height="8" rx="1" />
              <rect x="2" y="14" width="8" height="8" rx="1" />
              <rect x="14" y="14" width="4" height="4" rx="1" />
              <path d="M22 14h-4v4" /><path d="M22 22h-4v-4" /><path
                d="M18 22h4"
              />
            </svg>
          </a>
        </div>
      </header>

      <!-- Week Navigator -->
      <WeekNavigator
        {weekOffset}
        {isTodayWeek}
        theme={currentMember.theme}
        onPrev={() => weekOffset--}
        onNext={() => weekOffset++}
        onToday={() => (weekOffset = todayOffset)}
      />

      <!-- Stats Row: Progress + Habits -->
      <div
        class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 mb-6 items-start"
      >
        <OverallProgress member={currentMember} days={visibleDays} />
        <HabitTracker
          habits={visibleHabits}
          theme={currentMember.theme}
          onToggleHabit={toggleHabit}
          onAddHabit={addHabit}
          onUpdateHabit={updateHabit}
          onDeleteHabit={deleteHabit}
          onReorderHabits={reorderHabits}
        />
      </div>
    </div>

    <!-- Day Cards: full-width scroll, cards visible beyond content area -->
    <section aria-label="Daily tasks" class="pb-4 sm:pb-6">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={scrollContainer}
        class="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-proximity
          hide-scrollbar scroll-aligned py-1 cursor-grab"
        onpointerdown={onDragPointerDown}
        onpointermove={onDragPointerMove}
        onpointerup={onDragPointerUp}
        onpointercancel={onDragPointerUp}
      >
        {#each visibleDays as day, dayIndex (day.dayName)}
          {@const isToday = isTodayWeek && day.isoDate === todayISO}
          <div
            class="min-w-0 shrink-0 snap-center
              max-[479px]:w-[85vw]
              min-[480px]:w-64 min-[480px]:max-w-96"
            data-iso={day.isoDate}
          >
            <DayCard
              {day}
              {dayIndex}
              {isToday}
              theme={currentMember.theme}
              onToggleTask={(taskId) => toggleTask(dayIndex, taskId)}
              onAddTask={(title, emoji) => addTask(dayIndex, title, emoji)}
              onDeleteTask={(taskId) => deleteTask(dayIndex, taskId)}
              onUpdateTask={(taskId, updates) =>
                updateTask(dayIndex, taskId, updates)}
              onReorderTasks={(taskIds) => reorderTasks(dayIndex, taskIds)}
              onMoveTask={moveTask}
            />
          </div>
        {/each}
      </div>
    </section>
  </div>
{:else}
  <!-- Empty state: no profiles -->
  <main class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center space-y-4 px-6">
      <div
        class="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          class="w-8 h-8 text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="8.5" cy="7" r="4" />
          <path
            d="M20 8v6M23 11h-6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">Welcome to ProSys</h1>
      <p class="text-gray-500 text-base">
        Create your first family member profile to get started.
      </p>
      <button
        onclick={openCreateDialog}
        class="px-6 py-3 rounded-xl bg-green-500 text-white font-medium
					hover:bg-green-600 transition-colors shadow-sm
					focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
      >
        Create First Profile
      </button>
    </div>
  </main>
{/if}

<ProfileDialog
  open={dialogOpen}
  member={editingMember}
  onSave={handleSave}
  onDelete={handleDelete}
  onClose={() => (dialogOpen = false)}
/>
