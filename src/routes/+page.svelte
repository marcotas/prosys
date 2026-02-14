<script lang="ts">
  import type { FamilyMember, ThemeConfig } from "$lib/data/fake";
  import { profileStore } from "$lib/stores/profiles.svelte";
  import FamilySwitcher from "$lib/components/FamilySwitcher.svelte";
  import OverallProgress from "$lib/components/OverallProgress.svelte";
  import HabitTracker from "$lib/components/HabitTracker.svelte";
  import DayCard from "$lib/components/DayCard.svelte";
  import ProfileDialog from "$lib/components/ProfileDialog.svelte";

  let selectedMemberId = $state(profileStore.members[0]?.id ?? "");
  let dialogOpen = $state(false);
  let editingMember = $state<FamilyMember | null>(null);

  let currentMember = $derived(
    profileStore.members.find((m) => m.id === selectedMemberId) ??
      profileStore.members[0],
  );
  let playful = $derived(currentMember?.theme.variant === "playful");

  function toggleTask(dayIndex: number, taskId: string) {
    const member = profileStore.members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    const task = member.days[dayIndex].tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      profileStore.persist();
    }
  }

  function addTask(dayIndex: number, title: string, emoji?: string) {
    profileStore.addTask(selectedMemberId, dayIndex, title, emoji);
  }

  function deleteTask(dayIndex: number, taskId: string) {
    profileStore.deleteTask(selectedMemberId, dayIndex, taskId);
  }

  function updateTask(
    dayIndex: number,
    taskId: string,
    updates: { title?: string; emoji?: string },
  ) {
    profileStore.updateTask(selectedMemberId, dayIndex, taskId, updates);
  }

  function toggleHabit(habitId: string, dayIndex: number) {
    const member = profileStore.members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    const habit = member.habits.find((h) => h.id === habitId);
    if (habit) {
      habit.days[dayIndex] = !habit.days[dayIndex];
      profileStore.persist();
    }
  }

  function addHabit(name: string, emoji?: string) {
    profileStore.addHabit(selectedMemberId, name, emoji);
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
            <p
              class="text-xs text-gray-500"
              style="color: {playful ? currentMember.theme.accent : ''}"
            >
              Week of {currentMember.weekStart}
            </p>
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

      <main>
        <!-- Stats Row: Progress + Habits -->
        <div class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 mb-6 items-start">
          <OverallProgress member={currentMember} />
          <HabitTracker
            habits={currentMember.habits}
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
            {#each currentMember.days as day, dayIndex (day.dayName)}
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
