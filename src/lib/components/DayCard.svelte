<script lang="ts">
	import { ArrowRight, Check, ClockCounterClockwise, Prohibit, Trash, XCircle } from 'phosphor-svelte';
	import DragHandle from './DragHandle.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import ReschedulePicker from './ReschedulePicker.svelte';
	import TaskContextMenu from './TaskContextMenu.svelte';
	import type { DayData, Task, ThemeConfig } from '$lib/types';
	import { sortable } from '$lib/utils/sortable';
	import { createSwipeController } from '$lib/utils/swipe.svelte';

	const {
		day,
		dayIndex,
		theme,
		isToday = false,
		isPast = false,
		onToggleTask,
		onAddTask,
		onDeleteTask,
		onUpdateTask,
		onReorderTasks,
		onMoveTask,
		onRescheduleTask
	}: {
		day: DayData;
		dayIndex: number;
		theme: ThemeConfig;
		isToday?: boolean;
		isPast?: boolean;
		onToggleTask: (taskId: string) => void;
		onAddTask: (title: string, emoji?: string) => void;
		onDeleteTask: (taskId: string) => void;
		onUpdateTask: (
			taskId: string,
			updates: { title?: string; emoji?: string }
		) => void;
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
	const playful = $derived(theme.variant === 'playful');
	const hasTasks = $derived(day.tasks.length > 0);

	// Add task state
	let newTaskTitle = $state('');

	// Edit task state
	let _editingTaskId = $state<string | null>(null);
	let _editValue = $state('');

	// ── Drag & Drop (SortableJS) ─────────────────────────
	// eslint-disable-next-line svelte/prefer-writable-derived
	let dndItems = $state<Task[]>([]);

	$effect(() => {
		dndItems = [...day.tasks];
	});

	// ── Swipe to reveal (move + delete) ──────────────────
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

	// ── Add task ──────────────────────────────────────────
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

	// ── Edit task ─────────────────────────────────────────
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
			// Revert to original if empty or unchanged
			el.textContent = originalTitle;
		}
		_editingTaskId = null;
		_editValue = '';
	}
</script>

<article
	class="h-full bg-white shadow-sm flex flex-col overflow-hidden
		{playful
			? 'rounded-3xl border-2'
			: 'rounded-2xl border border-gray-200/60'}
		{isToday ? 'ring-2 ring-offset-1' : ''}"
	style="{playful ? `border-color: ${theme.accent}25` : ''}{isToday ? `; --tw-ring-color: ${theme.accent}` : ''}"
	aria-label="{day.dayName} tasks{isToday ? ' (today)' : ''}"
>
	<!-- Header -->
	<div
		class="text-white px-4 py-2.5 flex items-center justify-between"
		style="background-color: {theme.headerBg}"
	>
		<div>
			<h3 class="font-bold text-sm tracking-wide">
				{#if playful}{day.dayName === 'Saturday' || day.dayName === 'Sunday'
					? '🎉 '
					: ''}{/if}{day.dayName}
			</h3>
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
		<div
			class="flex justify-center py-5"
			style={playful ? `background-color: ${theme.accentLight}30` : ''}
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
				{playful ? '✨ Tasks' : 'Tasks'}
			</h4>
		</div>

		<!-- Task list (sortable zone) -->
		<div
			use:sortable={{
				items: dndItems,
				group: { name: 'tasks', pull: true, put: true },
				onReorder: (taskIds) => onReorderTasks?.(taskIds),
				onMove: (taskId, toGroupId, targetTaskIds) => {
					onMoveTask?.(taskId, Number(toGroupId), targetTaskIds);
				}
			}}
			data-sort-group-id={String(dayIndex)}
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
				<div
					data-sort-id={task.id}
					class="relative overflow-hidden rounded-lg"
					role="listitem"
				>
					<TaskContextMenu
						onReschedule={() => openReschedule(task)}
						onDelete={() => onDeleteTask(task.id)}
						{isPast}
						isCancelled={taskCancelled}
						isRescheduled={taskRescheduled}
					>
						<!-- Swipe-reveal zone: Move + Delete/Cancel -->
						{#if isRevealed}
							<div
								class="absolute inset-y-0 right-0 flex"
								style="width: {SWIPE_ZONE}px"
							>
								<button
									onclick={() => openReschedule(task)}
									aria-label="Move task: {task.title}"
									class="flex-1 flex items-center justify-center text-white cursor-pointer"
									style="background-color: {theme.accent}"
								>
									<ArrowRight size="16" weight="bold" aria-hidden="true" />
								</button>
								<button
									onclick={() => handleDeleteSwiped(task.id)}
									aria-label="{isPast ? 'Cancel' : 'Delete'} task: {task.title}"
									class="flex-1 flex items-center justify-center text-white cursor-pointer"
									style="background-color: {isPast ? '#9ca3af' : '#ef4444'}"
								>
									{#if isPast}
										<Prohibit size="16" weight="bold" aria-hidden="true" />
									{:else}
										<Trash size="16" weight="bold" aria-hidden="true" />
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
								<div class="mt-0.5"><DragHandle {theme} /></div>
							{:else}
								<div class="w-5 shrink-0"></div>
							{/if}

							<!-- Checkbox / Status icon -->
							{#if taskRescheduled}
								<span
									class="shrink-0 w-[18px] h-[18px] mt-[3px] rounded-[5px] flex items-center justify-center mr-2.5"
									aria-label="Rescheduled"
								>
									<ClockCounterClockwise size="16" weight="regular" color="#d1d5db" aria-hidden="true" />
								</span>
							{:else if taskCancelled}
								<span
									class="shrink-0 w-[18px] h-[18px] mt-[3px] rounded-[5px] flex items-center justify-center mr-2.5"
									aria-label="Cancelled"
								>
									<XCircle size="16" weight="regular" color="#d1d5db" aria-hidden="true" />
								</span>
							{:else}
								<button
									onclick={() => onToggleTask(task.id)}
									role="checkbox"
									aria-checked={task.completed}
									aria-label="Mark {task.title} as {task.completed
										? 'incomplete'
										: 'complete'}"
									class="shrink-0 w-[18px] h-[18px] mt-[3px] rounded-[5px] flex items-center justify-center
										transition-all duration-150 mr-2.5
										{task.completed ? '' : 'border-2 hover:border-opacity-80'}"
									style={task.completed
										? `background-color: ${theme.checkColor}`
										: `border-color: ${playful ? `${theme.accent}50` : '#d1d5db'}`}
								>
									{#if task.completed}
										<Check size="10" weight="bold" color="white" aria-hidden="true" />
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
						</div>
					</TaskContextMenu>
				</div>
			{/each}
		</div>

		<!-- Add task input (outside dnd zone) -->
		<div class="pl-1 pr-4 py-1.5 flex items-center">
			<span class="shrink-0 w-5" aria-hidden="true"></span>
			<span
				class="shrink-0 w-[18px] h-[18px] rounded-[5px] mr-2.5 border-2 border-dashed opacity-30"
				style="border-color: {playful ? theme.accent : '#d1d5db'}"
				aria-hidden="true"
			></span>
			<input
				type="text"
				bind:value={newTaskTitle}
				onkeydown={handleAddKeydown}
				placeholder={playful ? 'Add task ✨' : '+ Add task'}
				class="flex-1 min-w-0 text-base leading-normal bg-transparent outline-hidden focus:outline-hidden
					placeholder:text-gray-300 {playful
						? 'placeholder:opacity-60'
						: ''} text-gray-700"
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
