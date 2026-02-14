<script lang="ts">
  import type { DayData, ThemeConfig } from "$lib/types";
  import ProgressRing from "./ProgressRing.svelte";

  let {
    day,
    theme,
    onToggleTask,
    onAddTask,
    onDeleteTask,
    onUpdateTask,
  } = $props<{
    day: DayData;
    theme: ThemeConfig;
    onToggleTask: (taskId: string) => void;
    onAddTask: (title: string, emoji?: string) => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, updates: { title?: string; emoji?: string }) => void;
  }>();

  let percent = $derived(
    day.tasks.length === 0
      ? 0
      : Math.round((day.tasks.filter((t: { completed: boolean }) => t.completed).length / day.tasks.length) * 100)
  );
  let playful = $derived(theme.variant === "playful");
  let hasTasks = $derived(day.tasks.length > 0);

  // Add task state
  let newTaskTitle = $state("");

  // Edit task state — always-visible input, track focus for value management
  let editingTaskId = $state<string | null>(null);
  let editValue = $state("");

  // Swipe state — only one task swiped open at a time
  const DELETE_ZONE = 64; // px width of the revealed delete zone
  const SWIPE_THRESHOLD = 30; // px to trigger snap
  let swipedOpenId = $state<string | null>(null);
  let dragState = $state<{
    taskId: string;
    startX: number;
    startY: number;
    currentX: number;
    locked: boolean; // locked to horizontal once direction determined
    scrolling: boolean; // detected vertical scroll
  } | null>(null);

  function getSwipeOffset(taskId: string): number {
    if (dragState?.taskId === taskId && dragState.locked) {
      const delta = dragState.currentX - dragState.startX;
      // Only allow swiping left (negative delta)
      const clamped = Math.max(-DELETE_ZONE, Math.min(0, delta));
      return clamped;
    }
    if (swipedOpenId === taskId) return -DELETE_ZONE;
    return 0;
  }

  function onPointerDown(e: PointerEvent, taskId: string) {
    // Close any other open swipe first
    if (swipedOpenId && swipedOpenId !== taskId) {
      swipedOpenId = null;
      return;
    }
    // If this task is already swiped open, allow the pointer to reset it
    const startOffset = swipedOpenId === taskId ? -DELETE_ZONE : 0;
    dragState = {
      taskId,
      startX: e.clientX - startOffset,
      startY: e.clientY,
      currentX: e.clientX,
      locked: false,
      scrolling: false,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragState) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // Determine direction if not yet locked
    if (!dragState.locked && !dragState.scrolling) {
      const absDx = Math.abs(e.clientX - (dragState.currentX === dragState.startX ? dragState.startX : dragState.currentX));
      const absDy = Math.abs(dy);
      // Need at least 8px movement to determine direction
      if (Math.abs(e.clientX - dragState.startX + (swipedOpenId === dragState.taskId ? DELETE_ZONE : 0)) > 8 || absDy > 8) {
        if (absDy > Math.abs(e.clientX - dragState.startX + (swipedOpenId === dragState.taskId ? DELETE_ZONE : 0))) {
          // Vertical — let the browser scroll
          dragState.scrolling = true;
          dragState = null;
          return;
        } else {
          // Horizontal — lock to swipe
          dragState.locked = true;
          // Prevent scroll while swiping
          e.preventDefault();
        }
      }
    }

    if (dragState?.locked) {
      e.preventDefault();
      dragState.currentX = e.clientX;
    }
  }

  function onPointerUp() {
    if (!dragState) return;
    if (dragState.locked) {
      const delta = dragState.currentX - dragState.startX;
      if (delta < -SWIPE_THRESHOLD) {
        swipedOpenId = dragState.taskId;
      } else {
        swipedOpenId = null;
      }
    }
    dragState = null;
  }

  function closeSwipe() {
    swipedOpenId = null;
  }

  function handleDeleteSwiped(taskId: string) {
    swipedOpenId = null;
    onDeleteTask(taskId);
  }

  // Add task
  function confirmAdd() {
    const title = newTaskTitle.trim();
    if (title) {
      onAddTask(title);
      newTaskTitle = "";
    }
  }

  function handleAddKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmAdd();
    } else if (e.key === "Escape") {
      newTaskTitle = "";
      (e.target as HTMLInputElement).blur();
    }
  }

  // Edit task — always-input, seamless editing
  function startEdit(taskId: string, currentTitle: string) {
    if (swipedOpenId) { closeSwipe(); return; }
    editingTaskId = taskId;
    editValue = currentTitle;
  }

  function commitEdit(taskId: string, originalTitle: string) {
    const val = editValue.trim();
    if (editingTaskId === taskId && val && val !== originalTitle) {
      onUpdateTask(taskId, { title: val });
    }
    editingTaskId = null;
    editValue = "";
  }
</script>

<svelte:window
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
/>

<article
  class="bg-white shadow-sm flex flex-col overflow-hidden
		{playful ? 'rounded-3xl border-2' : 'rounded-2xl border border-gray-200/60'}"
  style={playful ? `border-color: ${theme.accent}25` : ""}
  aria-label="{day.dayName} tasks"
>
  <!-- Header -->
  <div
    class="text-white px-4 py-2.5 flex items-center justify-between"
    style="background-color: {theme.headerBg}"
  >
    <div>
      <h3 class="font-bold text-sm tracking-wide">
        {#if playful}{day.dayName === "Saturday" || day.dayName === "Sunday"
            ? "🎉 "
            : ""}{/if}{day.dayName}
      </h3>
      <p class="text-[11px] opacity-70 mt-0.5">{day.date}</p>
    </div>
    {#if hasTasks}
      <span
        class="text-[11px] font-bold px-2 py-0.5 rounded-full"
        style="background-color: rgba(255,255,255,0.2)"
      >
        {day.tasks.filter((t: { completed: boolean }) => t.completed).length}/{day.tasks.length}
      </span>
    {/if}
  </div>

  <!-- Progress Ring -->
  {#if hasTasks}
    <div
      class="flex justify-center py-5"
      style={playful ? `background-color: ${theme.accentLight}30` : ""}
    >
      <ProgressRing
        {percent}
        size={90}
        strokeWidth={7}
        color={theme.ringColor}
        variant={theme.variant}
      />
    </div>
  {/if}

  <!-- Tasks -->
  <div class="flex-1 flex flex-col">
    <!-- Tasks label -->
    <div
      class="px-4 py-2 border-t"
      style="border-color: {playful ? `${theme.accent}15` : '#f3f4f6'}"
    >
      <h4
        class="text-[11px] font-semibold uppercase tracking-widest"
        style="color: {playful ? theme.accent : '#9ca3af'}"
      >
        {playful ? "✨ Tasks" : "Tasks"}
      </h4>
    </div>

    <!-- Task list -->
    <ul class="pb-1" role="list">
      {#each day.tasks as task (task.id)}
        {@const offset = getSwipeOffset(task.id)}
        {@const isSwiping = dragState?.taskId === task.id && dragState?.locked}
        {@const isRevealed = offset < 0 || swipedOpenId === task.id}
        <li class="relative overflow-hidden group/task">
            <!-- Delete zone (behind the task) — only render when swiped -->
            {#if isRevealed}
              <button
                onclick={() => handleDeleteSwiped(task.id)}
                aria-label="Delete task: {task.title}"
                class="absolute inset-y-0 right-0 flex items-center justify-center text-white cursor-pointer"
                style="width: {DELETE_ZONE}px; background-color: #ef4444"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            {/if}

            <!-- Swipeable task content -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="relative bg-white flex items-center w-full px-4 py-2 select-none
                {isSwiping ? '' : 'transition-transform duration-200 ease-out'}"
              style="transform: translateX({offset}px); touch-action: pan-y;"
              onpointerdown={(e) => onPointerDown(e, task.id)}
            >
              <!-- Checkbox -->
              <button
                onclick={() => onToggleTask(task.id)}
                role="checkbox"
                aria-checked={task.completed}
                aria-label="Mark {task.title} as {task.completed ? 'incomplete' : 'complete'}"
                class="shrink-0 w-[18px] h-[18px] rounded-[5px] flex items-center justify-center
                  transition-all duration-150 mr-2.5
                  {task.completed ? '' : 'border-2 hover:border-opacity-80'}"
                style={task.completed
                  ? `background-color: ${theme.checkColor}`
                  : `border-color: ${playful ? `${theme.accent}50` : "#d1d5db"}`}
              >
                {#if task.completed}
                  <svg
                    class="w-2.5 h-2.5 text-white"
                    viewBox="0 0 12 12"
                    fill="none"
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
              </button>

              <!-- Task title — always an input, styled as plain text -->
              {#if task.emoji}<span class="mr-0.5 select-none" aria-hidden="true">{task.emoji}</span>{/if}
              <input
                type="text"
                value={editingTaskId === task.id ? editValue : task.title}
                oninput={(e) => { editValue = e.currentTarget.value; }}
                onfocus={(e) => { startEdit(task.id, task.title); }}
                onblur={() => commitEdit(task.id, task.title)}
                onkeydown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { editingTaskId = null; editValue = ''; e.currentTarget.value = task.title; e.currentTarget.blur(); }
                }}
                class="flex-1 min-w-0 text-[13px] leading-snug bg-transparent border-none outline-hidden p-0 m-0
                  focus:outline-hidden
                  {task.completed
                  ? 'line-through text-gray-400 decoration-gray-300'
                  : 'text-gray-700'}"
                aria-label="Task: {task.title}"
              />

              <!-- Delete icon — visible on hover (desktop) / focus -->
              <button
                onclick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                aria-label="Delete task: {task.title}"
                class="shrink-0 ml-1 w-5 h-5 rounded-md flex items-center justify-center
                  opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100
                  transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50"
              >
                <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
        </li>
      {/each}

      <!-- Always-visible add task input — looks like a task item -->
      <li class="px-4 py-2 flex items-center">
        <span
          class="shrink-0 w-[18px] h-[18px] rounded-[5px] mr-2.5 border-2 border-dashed opacity-30"
          style="border-color: {playful ? theme.accent : '#d1d5db'}"
          aria-hidden="true"
        ></span>
        <input
          type="text"
          bind:value={newTaskTitle}
          onkeydown={handleAddKeydown}
          placeholder={playful ? "Add task ✨" : "+ Add task"}
          class="flex-1 min-w-0 text-[13px] leading-snug bg-transparent outline-hidden focus:outline-hidden
            placeholder:text-gray-300 {playful ? 'placeholder:opacity-60' : ''} text-gray-700"
          aria-label="Add task to {day.dayName}"
        />
      </li>
    </ul>
  </div>
</article>
