<script lang="ts">
  import type { Member, ThemeConfig, DayData } from "$lib/types";
  import { computeWeekDays, getWeekStart, getTodayWeekOffset } from "$lib/utils/dates";
  import { memberStore } from "$lib/stores/members.svelte";
  import { taskStore } from "$lib/stores/tasks.svelte";
  import { habitStore } from "$lib/stores/habits.svelte";
  import FamilySwitcher from "$lib/components/FamilySwitcher.svelte";
  import WeekNavigator from "$lib/components/WeekNavigator.svelte";
  import OverallProgress from "$lib/components/OverallProgress.svelte";
  import HabitTracker from "$lib/components/HabitTracker.svelte";
  import DayCard from "$lib/components/DayCard.svelte";
  import ProfileDialog from "$lib/components/ProfileDialog.svelte";

  // Load members from database on mount
  $effect(() => {
    memberStore.load();
  });

  let dialogOpen = $state(false);
  let editingMember = $state<Member | null>(null);
  let weekOffset = $state(getTodayWeekOffset());

  let currentMember = $derived(memberStore.selectedMember);
  let playful = $derived(currentMember?.theme.variant === "playful");

  // Week navigation state
  let todayOffset = $derived(getTodayWeekOffset());
  let isTodayWeek = $derived(weekOffset === todayOffset);
  let currentWeekStart = $derived(getWeekStart(weekOffset));

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

  // ── Week data with tasks from store ──
  let visibleDays = $derived.by(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    return computeWeekDays(weekOffset).map((d, i) => ({
      dayName: d.dayName,
      date: d.date,
      isoDate: d.isoDate,
      tasks: memberId ? taskStore.getTasksForDay(memberId, weekStart, i) : [],
    }));
  });

  // ── Habit data from store ──
  let visibleHabits = $derived.by(() => {
    const memberId = memberStore.selectedMemberId;
    const weekStart = currentWeekStart;
    if (!memberId) return [];
    return habitStore.getHabitsWithDays(memberId, weekStart);
  });

  // Task operations — wired to task store
  function toggleTask(_dayIndex: number, taskId: string) {
    taskStore.toggle(taskId);
  }
  function addTask(dayIndex: number, title: string, emoji?: string) {
    const memberId = memberStore.selectedMemberId;
    if (!memberId) return;
    taskStore.create({ memberId, weekStart: currentWeekStart, dayIndex, title, emoji });
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
    <div class="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
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

        <FamilySwitcher
          members={memberStore.members}
          selectedId={memberStore.selectedMemberId}
          onSelect={(id) => memberStore.select(id)}
          onAdd={openCreateDialog}
          onEdit={openEditDialog}
        />
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

      <main>
        <!-- Stats Row: Progress + Habits -->
        <div class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 mb-6 items-start">
          <OverallProgress member={currentMember} days={visibleDays} />
          <HabitTracker
            habits={visibleHabits}
            theme={currentMember.theme}
            onToggleHabit={toggleHabit}
            onAddHabit={addHabit}
            onUpdateHabit={updateHabit}
            onDeleteHabit={deleteHabit}
          />
        </div>

        <!-- Day Cards Grid -->
        <section aria-label="Daily tasks">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4"
          >
            {#each visibleDays as day, dayIndex (day.dayName)}
              <DayCard
                {day}
                theme={currentMember.theme}
                onToggleTask={(taskId) => toggleTask(dayIndex, taskId)}
                onAddTask={(title, emoji) => addTask(dayIndex, title, emoji)}
                onDeleteTask={(taskId) => deleteTask(dayIndex, taskId)}
                onUpdateTask={(taskId, updates) => updateTask(dayIndex, taskId, updates)}
              />
            {/each}
          </div>
        </section>
      </main>
    </div>
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
