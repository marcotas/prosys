<script lang="ts">
	import { ArrowRight, Check, ClockCounterClockwise, Prohibit, Trash, XCircle } from 'phosphor-svelte';
	import { flip } from 'svelte/animate';
	import {
		dragHandleZone,
		SHADOW_ITEM_MARKER_PROPERTY_NAME,
		type DndEvent
	} from 'svelte-dnd-action';
	import AssignPicker from './AssignPicker.svelte';
	import DragHandle from './DragHandle.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import ReschedulePicker from './ReschedulePicker.svelte';
	import TaskContextMenu from './TaskContextMenu.svelte';
	import type {
		DayData,
		Task,
		Member,
		ThemeConfig
	} from '$lib/types';
	import { createSwipeController } from '$lib/utils/swipe.svelte';

	const {
		day,
		dayIndex,
		isToday = false,
		isPast = false,
		members,
		onToggleTask,
		onAddTask,
		onDeleteTask,
		onUpdateTask,
		onAssignTask,
		onReorderTasks,
		onMoveTask,
		onRescheduleTask
	}: {
		day: DayData;
		dayIndex: number;
		isToday?: boolean;
		isPast?: boolean;
		members: Member[];
		onToggleTask: (taskId: string) => void;
		onAddTask: (title: string, emoji?: string) => void;
		onDeleteTask: (taskId: string) => void;
		onUpdateTask: (
			taskId: string,
			updates: { title?: string; emoji?: string }
		) => void;
		onAssignTask: (taskId: string, memberId: string | null) => void;
		onReorderTasks?: (taskIds: string[]) => void;
		onMoveTask?: (
			taskId: string,
			toDayIndex: number,
			orderedTaskIds: string[]
		) => void;
		onRescheduleTask?: (
			taskId: string,
			toWeekStart: string,
			toDayIndex: number
		) => void;
	} = $props();

	const THEME: ThemeConfig = {
		variant: 'default',
		accent: '#6366f1',
		accentLight: '#eef2ff',
		accentDark: '#312e81',
		headerBg: '#6366f1',
		ringColor: '#6366f1',
		checkColor: '#6366f1',
		emoji: ''
	};

	// Exclude cancelled and rescheduled tasks from progress calculation
	const activeTasks = $derived(day.tasks.filter((t) => t.status === 'active'));
	const percent = $derived(
		activeTasks.length === 0
			? 0
			: Math.round(
				(activeTasks.filter((t) => t.completed).length / activeTasks.length) *
				100
			)
	);
	const hasTasks = $derived(day.tasks.length > 0);

	let newTaskTitle = $state('');
	let _editingTaskId = $state<string | null>(null);
	let _editValue = $state('');

	// Member lookup
	const memberMap = $derived(new Map(members.map((m) => [m.id, m])));

	function getTaskMember(task: Task): Member | undefined {
		if (!task.memberId) return undefined;
		return memberMap.get(task.memberId);
	}

	function getTaskTheme(task: Task): ThemeConfig {
		const member = getTaskMember(task);
		return member?.theme ?? THEME;
	}

	// ── Drag & Drop ──────────────────────────────────────
	const FLIP_DURATION = 200;
	// eslint-disable-next-line svelte/prefer-writable-derived
	let dndItems = $state<Task[]>([]);

	$effect(() => {
		dndItems = [...day.tasks];
	});

	function handleDndConsider(e: CustomEvent<DndEvent<Task>>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<DndEvent<Task>>) {
		const items = e.detail.items.filter(
			(t: Task) => !(t as unknown as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME]
		);
		dndItems = items;

		const movedTask = items.find((t) => t.dayIndex !== dayIndex);
		if (movedTask) {
			const taskIds = items.map((t) => t.id);
			onMoveTask?.(movedTask.id, dayIndex, taskIds);
			return;
		}

		if (items.length === 0) return;
		const taskIds = items.map((t) => t.id);
		onReorderTasks?.(taskIds);
	}

	// ── Swipe to reveal ──────────────────────────────────
	const SWIPE_ZONE = 120;
	const swipe = createSwipeController({ zoneWidth: SWIPE_ZONE, threshold: 40 });
	$effect(() => () => swipe.destroy());

	function handleDeleteSwiped(taskId: string) {
		swipe.close();
		onDeleteTask(taskId);
	}

	// ── Reschedule modal ─────────────────────────────────
	let rescheduleTask = $state<Task | null>(null);
	let rescheduleOpen = $state(false);

	function openReschedule(task: Task) {
		rescheduleTask = task;
		rescheduleOpen = true;
		swipe.close();
	}

	function handleReschedule(toWeekStart: string, toDayIndex: number) {
		if (rescheduleTask) {
			onRescheduleTask?.(rescheduleTask.id, toWeekStart, toDayIndex);
		}
	}

	// ── Add task ─────────────────────────────────────────
	function confirmAdd() {
		const title = newTaskTitle.trim();
		if (title) {
			onAddTask(title);
			newTaskTitle = '';
		}
	}

	function handleAddKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			confirmAdd();
		} else if (e.key === 'Escape') {
			newTaskTitle = '';
			(e.target as HTMLInputElement).blur();
		}
	}

	// ── Edit task ────────────────────────────────────────
	function startEdit(taskId: string, currentTitle: string) {
		if (swipe.swipedOpenId) {
			swipe.close();
			return;
		}
		_editingTaskId = taskId;
		_editValue = currentTitle;
	}

	function commitEditFromContentEditable(
		taskId: string,
		originalTitle: string,
		newValue: string,
		el: HTMLElement
	) {
		const val = newValue.trim();
		if (val && val !== originalTitle) {
			onUpdateTask(taskId, { title: val });
		} else {
			el.textContent = originalTitle;
		}
		_editingTaskId = null;
		_editValue = '';
	}
</script>

<article
	class="h-full bg-white shadow-sm flex flex-col overflow-hidden
		rounded-2xl border border-gray-200/60
		{isToday ? 'ring-2 ring-offset-1' : ''}"
	style={isToday ? `--tw-ring-color: ${THEME.accent}` : ''}
	aria-label="{day.dayName} tasks{isToday ? ' (today)' : ''}"
>
	<!-- Header -->
	<div
		class="text-white px-4 py-2.5 flex items-center justify-between"
		style="background-color: {THEME.headerBg}"
	>
		<div>
			<h3 class="font-bold text-sm tracking-wide">{day.dayName}</h3>
			<p class="text-[11px] opacity-70 mt-0.5">{day.date}</p>
		</div>
		{#if hasTasks}
			<span
				class="text-[11px] font-bold px-2 py-0.5 rounded-full"
				style="background-color: rgba(255,255,255,0.2)"
			>
				{activeTasks.filter((t) => t.completed).length}/{activeTasks.length}
			</span>
		{/if}
	</div>

	<!-- Progress Ring -->
	{#if hasTasks}
		<div class="flex justify-center py-5">
			<ProgressRing
				{percent}
				size={90}
				strokeWidth={7}
				color={THEME.ringColor}
				variant="default"
			/>
		</div>
	{/if}

	<!-- Tasks -->
	<div class="flex-1 flex flex-col">
		<div class="px-4 py-2 border-t" style="border-color: #f3f4f6">
			<h4
				class="text-[11px] font-semibold uppercase tracking-widest text-gray-400"
			>
				Tasks
			</h4>
		</div>

		<!-- Task list (sortable dnd zone) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			use:dragHandleZone={{
				items: dndItems,
				flipDurationMs: FLIP_DURATION,
				type: 'task',
				dropTargetStyle: {}
			}}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
			class="pb-1 flex-1"
			role="list"
		>
			{#each dndItems as task (task.id)}
				{@const taskCancelled = task.status === 'cancelled'}
				{@const taskRescheduled = task.status === 'rescheduled'}
				{@const taskInactive = taskCancelled || taskRescheduled}
				{@const offset = taskInactive ? 0 : swipe.getSwipeOffset(task.id)}
				{@const isSwiping =
					!taskInactive && swipe.swipeState?.itemId === task.id && swipe.swipeState?.locked}
				{@const isRevealed = !taskInactive && (offset < 0 || swipe.swipedOpenId === task.id)}
				{@const isShadow = (task as unknown as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
				{@const taskTheme = getTaskTheme(task)}
				{@const _taskMember = getTaskMember(task)}
				<div
					animate:flip={{ duration: FLIP_DURATION }}
					class="relative overflow-hidden {isShadow
						? 'dnd-shadow-item'
						: ''}"
					role="listitem"
				>
					<TaskContextMenu
						onReschedule={() => openReschedule(task)}
						onDelete={() => onDeleteTask(task.id)}
						{isPast}
						isCancelled={taskCancelled}
						isRescheduled={taskRescheduled}
					>
						<!-- Swipe-reveal zone -->
						{#if isRevealed}
							<div
								class="absolute inset-y-0 right-0 flex"
								style="width: {SWIPE_ZONE}px"
							>
								<button
									onclick={() => openReschedule(task)}
									aria-label="Move task: {task.title}"
									class="flex-1 flex items-center justify-center text-white cursor-pointer"
									style="background-color: {THEME.accent}"
								>
									<ArrowRight size="16" weight="bold" color="currentColor" />
								</button>
								<button
									onclick={() => handleDeleteSwiped(task.id)}
									aria-label="{isPast ? 'Cancel' : 'Delete'} task: {task.title}"
									class="flex-1 flex items-center justify-center text-white cursor-pointer"
									style="background-color: {isPast ? '#9ca3af' : '#ef4444'}"
								>
									{#if isPast}
										<Prohibit size="16" weight="bold" color="currentColor" />
									{:else}
										<Trash size="16" weight="bold" color="currentColor" />
									{/if}
								</button>
							</div>
						{/if}

						<!-- Swipeable task content -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="relative bg-white flex items-start w-full pl-1 pr-4 py-1.5 select-none touch-pan-y
								{isSwiping ? '' : 'transition-transform duration-200 ease-out'}"
							style="transform: translateX({offset}px)"
							ontouchstart={taskInactive ? undefined : (e) => swipe.onTouchStart(e, task.id)}
						>
							<!-- Drag handle (hidden for inactive tasks) -->
							{#if !taskInactive}
								<div class="mt-0.5"><DragHandle theme={THEME} /></div>
							{:else}
								<div class="w-5 shrink-0"></div>
							{/if}

							<!-- Checkbox / Status icon -->
							{#if taskRescheduled}
								<span
									class="shrink-0 w-4.5 h-4.5 mt-0.75 rounded-[5px] flex items-center justify-center mr-2.5"
									aria-label="Rescheduled"
								>
									<ClockCounterClockwise size="16" weight="regular" color="currentColor" class="text-gray-300" />
								</span>
							{:else if taskCancelled}
								<span
									class="shrink-0 w-4.5 h-4.5 mt-0.75 rounded-[5px] flex items-center justify-center mr-2.5"
									aria-label="Cancelled"
								>
									<XCircle size="16" weight="regular" color="currentColor" class="text-gray-300" />
								</span>
							{:else}
								<button
									onclick={() => onToggleTask(task.id)}
									role="checkbox"
									aria-checked={task.completed}
									aria-label="Mark {task.title} as {task.completed
										? 'incomplete'
										: 'complete'}"
									class="shrink-0 w-4.5 h-4.5 mt-0.75 rounded-[5px] flex items-center justify-center
										transition-all duration-150 mr-2.5
										{task.completed ? '' : 'border-2 hover:border-opacity-80'}"
									style={task.completed
										? `background-color: ${taskTheme.checkColor}`
										: 'border-color: #d1d5db'}
								>
									{#if task.completed}
										<Check size="10" weight="bold" color="currentColor" class="text-white" />
									{/if}
								</button>
							{/if}

							<!-- Task title -->
							{#if task.emoji}<span class="mr-0.5 select-none {taskInactive ? 'opacity-40' : ''}" aria-hidden="true"
							>{task.emoji}</span
							>{/if}
							{#if taskInactive}
								<span
									class="flex-1 min-w-0 text-base leading-normal opacity-40 line-through text-gray-400 decoration-gray-300 wrap-anywhere"
								>{task.title}</span>
							{:else}
								<span
									contenteditable="true"
									role="textbox"
									tabindex="0"
									aria-label="Task: {task.title}"
									onfocus={() => startEdit(task.id, task.title)}
									onblur={(e) => {
										const val =
											(e.currentTarget as HTMLElement).textContent?.trim() ?? '';
										commitEditFromContentEditable(
											task.id,
											task.title,
											val,
											e.currentTarget as HTMLElement
										);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											(e.currentTarget as HTMLElement).blur();
										}
										if (e.key === 'Escape') {
											e.preventDefault();
											(e.currentTarget as HTMLElement).textContent = task.title;
											_editingTaskId = null;
											(e.currentTarget as HTMLElement).blur();
										}
									}}
									onpaste={(e) => {
										e.preventDefault();
										const text = e.clipboardData?.getData('text/plain') ?? '';
										document.execCommand('insertText', false, text);
									}}
									class="flex-1 min-w-0 text-base leading-normal outline-none cursor-text wrap-anywhere
										{task.completed
											? 'line-through text-gray-400 decoration-gray-300'
											: 'text-gray-700'}">{task.title}</span
								>
							{/if}

							<!-- Member badge / assign picker (hidden for inactive) -->
							{#if !taskInactive}
								<div class="shrink-0 ml-1.5 mt-px">
									<AssignPicker
										{members}
										currentMemberId={task.memberId}
										onAssign={(mid) => onAssignTask(task.id, mid)}
									/>
								</div>
							{/if}
						</div>
					</TaskContextMenu>
				</div>
			{/each}
		</div>

		<!-- Add task input -->
		<div class="pl-1 pr-4 py-1.5 flex items-center">
			<span class="shrink-0 w-5" aria-hidden="true"></span>
			<span
				class="shrink-0 w-4.5 h-4.5 rounded-[5px] mr-2.5 border-2 border-dashed opacity-30"
				style="border-color: #d1d5db"
				aria-hidden="true"
			></span>
			<input
				type="text"
				bind:value={newTaskTitle}
				onkeydown={handleAddKeydown}
				placeholder="+ Add task"
				class="flex-1 min-w-0 text-base leading-normal bg-transparent outline-hidden focus:outline-hidden
					placeholder:text-gray-300 text-gray-700"
				aria-label="Add task to {day.dayName}"
			/>
		</div>
	</div>

	<ReschedulePicker
		task={rescheduleTask}
		bind:open={rescheduleOpen}
		isPastTask={isPast}
		onReschedule={handleReschedule}
	/>
</article>

<style>
  :global([aria-grabbed="true"]) {
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    opacity: 0.95;
    z-index: 50;
  }

  .dnd-shadow-item {
    opacity: 0.35;
    border: 2px dashed #9ca3af;
    border-radius: 8px;
    background: #f9fafb;
  }
  .dnd-shadow-item > * {
    visibility: hidden;
  }
</style>
