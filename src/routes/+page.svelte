<script lang="ts">
  import type { FamilyMember, ThemeConfig, DayData } from "$lib/data/fake";
  import {
    computeWeekDays,
    getTodayWeekOffset,
  } from "$lib/data/fake";
  import { profileStore } from "$lib/stores/profiles.svelte";
  import FamilySwitcher from "$lib/components/FamilySwitcher.svelte";
  import WeekNavigator from "$lib/components/WeekNavigator.svelte";
  import OverallProgress from "$lib/components/OverallProgress.svelte";
  import HabitTracker from "$lib/components/HabitTracker.svelte";
  import DayCard from "$lib/components/DayCard.svelte";
  import ProfileDialog from "$lib/components/ProfileDialog.svelte";

  let selectedMemberId = $state(profileStore.members[0]?.id ?? "");
  let dialogOpen = $state(false);
  let editingMember = $state<FamilyMember | null>(null);
  const DATA_WEEK_OFFSET = 0; // the fake data lives at offset 0 (Nov 2, 2025)
  let weekOffset = $state(getTodayWeekOffset());

  let currentMember = $derived(
    profileStore.members.find((m) => m.id === selectedMemberId) ??
      profileStore.members[0],
  );
  let playful = $derived(currentMember?.theme.variant === "playful");

  // Week navigation state
  let todayOffset = $derived(getTodayWeekOffset());
  let isTodayWeek = $derived(weekOffset === todayOffset);

  // ── Week data cache ──
  // Plain JS caches keyed by "memberId:weekOffset". Mutations go directly to them.
  // A reactive version counter (_ver) forces $derived to re-run and return
  // new references so Svelte picks up the changes.
  const _weekData: Record<string, DayData[]> = {};
  const _habitDays: Record<string, Record<string, boolean[]>> = {}; // habitId -> 7 bools
  let _ver = $state(0);
  const EMPTY_DAYS = [false, false, false, false, false, false, false];

  function wk(memberId: string, offset: number): string {
    return `${memberId}:${offset}`;
  }

  function ensureWeekData(memberId: string, offset: number): DayData[] {
    const key = wk(memberId, offset);
    if (!_weekData[key]) {
      if (offset === DATA_WEEK_OFFSET) {
        // Data week: deep-clone the store data so mutations stay in plain JS.
        // We sync back to the store on persist.
        const member = profileStore.members.find((m) => m.id === memberId);
        _weekData[key] = member
          ? JSON.parse(JSON.stringify(member.days))
          : [];
      } else {
        _weekData[key] = computeWeekDays(offset).map((d) => ({
          dayName: d.dayName,
          date: d.date,
          tasks: [],
        }));
      }
    }
    return _weekData[key];
  }

  // Returns fresh object references each time _ver, member, or week changes.
  // Spread DayData AND each task so Svelte's keyed {#each} detects mutations.
  let visibleDays = $derived.by(() => {
    void _ver;
    return ensureWeekData(selectedMemberId, weekOffset).map((d) => ({
      ...d,
      tasks: d.tasks.map((t) => ({ ...t })),
    }));
  });

  // ── Habit completion cache (per-week) ──
  function ensureHabitDays(
    memberId: string,
    offset: number,
  ): Record<string, boolean[]> {
    const key = wk(memberId, offset);
    if (!_habitDays[key]) {
      const member = profileStore.members.find((m) => m.id === memberId);
      if (!member) return {};
      const map: Record<string, boolean[]> = {};
      if (offset === DATA_WEEK_OFFSET) {
        for (const h of member.habits) map[h.id] = [...h.days];
      } else {
        for (const h of member.habits) map[h.id] = [...EMPTY_DAYS];
      }
      _habitDays[key] = map;
    }
    return _habitDays[key];
  }

  // Habit definitions from the store, completion states from the per-week cache.
  // Spread each habit so Svelte's keyed {#each} detects toggles.
  let visibleHabits = $derived.by(() => {
    void _ver;
    if (!currentMember) return [];
    const dayMap = ensureHabitDays(selectedMemberId, weekOffset);
    return currentMember.habits.map((h) => ({
      ...h,
      days: [...(dayMap[h.id] ?? EMPTY_DAYS)],
    }));
  });

  // Sync local cache back to the store for the data week
  function persistDataWeek() {
    const member = profileStore.members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    const key = wk(selectedMemberId, DATA_WEEK_OFFSET);
    const cached = _weekData[key];
    if (!cached) return;
    // Overwrite each day's tasks in the store
    for (let i = 0; i < cached.length && i < member.days.length; i++) {
      member.days[i].tasks = cached[i].tasks;
    }
    profileStore.persist();
  }

  // Helper: generate a unique ID
  function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Task operations ── mutate plain cache, bump version, optionally persist
  function toggleTask(dayIndex: number, taskId: string) {
    const days = ensureWeekData(selectedMemberId, weekOffset);
    const task = days[dayIndex]?.tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      _ver++;
      if (weekOffset === DATA_WEEK_OFFSET) persistDataWeek();
    }
  }

  function addTask(dayIndex: number, title: string, emoji?: string) {
    const days = ensureWeekData(selectedMemberId, weekOffset);
    const day = days[dayIndex];
    if (!day) return;
    day.tasks.push({
      id: genId(),
      title,
      completed: false,
      ...(emoji ? { emoji } : {}),
    });
    _ver++;
    if (weekOffset === DATA_WEEK_OFFSET) persistDataWeek();
  }

  function deleteTask(dayIndex: number, taskId: string) {
    const days = ensureWeekData(selectedMemberId, weekOffset);
    const day = days[dayIndex];
    if (!day) return;
    const idx = day.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      day.tasks.splice(idx, 1);
      _ver++;
      if (weekOffset === DATA_WEEK_OFFSET) persistDataWeek();
    }
  }

  function updateTask(
    dayIndex: number,
    taskId: string,
    updates: { title?: string; emoji?: string },
  ) {
    const days = ensureWeekData(selectedMemberId, weekOffset);
    const task = days[dayIndex]?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.emoji !== undefined) task.emoji = updates.emoji || undefined;
    _ver++;
    if (weekOffset === DATA_WEEK_OFFSET) persistDataWeek();
  }

  // Sync habit completion cache back to the store for the data week
  function persistHabitDataWeek() {
    const member = profileStore.members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    const key = wk(selectedMemberId, DATA_WEEK_OFFSET);
    const dayMap = _habitDays[key];
    if (!dayMap) return;
    for (const h of member.habits) {
      if (dayMap[h.id]) h.days = dayMap[h.id];
    }
    profileStore.persist();
  }

  function toggleHabit(habitId: string, dayIndex: number) {
    const dayMap = ensureHabitDays(selectedMemberId, weekOffset);
    if (!dayMap[habitId]) dayMap[habitId] = [...EMPTY_DAYS];
    dayMap[habitId][dayIndex] = !dayMap[habitId][dayIndex];
    _ver++;
    if (weekOffset === DATA_WEEK_OFFSET) persistHabitDataWeek();
  }

  function addHabit(name: string, emoji?: string) {
    profileStore.addHabit(selectedMemberId, name, emoji);
    // visibleHabits re-derives from currentMember.habits (reactive);
    // new habit defaults to all-unchecked via EMPTY_DAYS fallback.
  }

  function updateHabit(
    habitId: string,
    updates: { name?: string; emoji?: string },
  ) {
    profileStore.updateHabit(selectedMemberId, habitId, updates);
  }

  function deleteHabit(habitId: string) {
    profileStore.deleteHabit(selectedMemberId, habitId);
  }

  function openCreateDialog() {
    editingMember = null;
    dialogOpen = true;
  }

  function openEditDialog(member: FamilyMember) {
    editingMember = member;
    dialogOpen = true;
  }

  function handleSave(data: {
    name: string;
    theme: ThemeConfig;
    quote: { text: string; author: string };
  }) {
    if (editingMember) {
      profileStore.updateMember(editingMember.id, data);
    } else {
      const newId = profileStore.addMember(data);
      selectedMemberId = newId;
    }
  }

  function handleDelete(id: string) {
    const wasSelected = selectedMemberId === id;
    profileStore.deleteMember(id);
    if (wasSelected && profileStore.members.length > 0) {
      selectedMemberId = profileStore.members[0].id;
    }
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
          members={profileStore.members}
          selectedId={selectedMemberId}
          onSelect={(id) => (selectedMemberId = id)}
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
