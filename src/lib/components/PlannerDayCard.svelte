<script lang="ts">
	import type { DayData, Task, Member, ThemeConfig, PlannerTask } from '$lib/types';
	import {
		dragHandleZone,
		SHADOW_ITEM_MARKER_PROPERTY_NAME
	} from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import ProgressRing from './ProgressRing.svelte';
	import DragHandle from './DragHandle.svelte';
	import MemberBadge from './MemberBadge.svelte';
	import AssignPicker from './AssignPicker.svelte';
	import { createSwipeController } from '$lib/utils/swipe.svelte';

	let {
		day,
		dayIndex,
		isToday = false,
		members,
		onToggleTask,
		onAddTask,
		onDeleteTask,
		onUpdateTask,
		onAssignTask,
		onReorderTasks,
		onMoveTask
	}: {
		day: DayData;
		dayIndex: number;
		isToday?: boolean;
		members: Member[];
		onToggleTask: (taskId: string) => void;
		onAddTask: (title: string, emoji?: string) => void;
		onDeleteTask: (taskId: string) => void;
		onUpdateTask: (taskId: string, updates: { title?: string; emoji?: string }) => void;
		onAssignTask: (taskId: string, memberId: string | null) => void;
		onReorderTasks?: (taskIds: string[]) => void;
		onMoveTask?: (taskId: string, toDayIndex: number, orderedTaskIds: string[]) => void;
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

	let percent = $derived(
		day.tasks.length === 0
			? 0
			: Math.round((day.tasks.filter((t) => t.completed).length / day.tasks.length) * 100)
	);
	let hasTasks = $derived(day.tasks.length > 0);

	let newTaskTitle = $state('');
	let editingTaskId = $state<string | null>(null);
	let editValue = $state('');
	let assignPickerTaskId = $state<string | null>(null);

	// Member lookup
	let memberMap = $derived(new Map(members.map((m) => [m.id, m])));

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
	let dndItems = $state<Task[]>([]);

	$effect(() => {
		dndItems = [...day.tasks];
	});

	function handleDndConsider(e: CustomEvent<{ items: any[] }>) {
		dndItems = e.detail.items as Task[];
	}

	function handleDndFinalize(e: CustomEvent<{ items: any[] }>) {
		const items = (e.detail.items as Task[]).filter(
			(t: any) => !t[SHADOW_ITEM_MARKER_PROPERTY_NAME]
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

	// ── Move to day picker ───────────────────────────────
	const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	let movePickerTaskId = $state<string | null>(null);

	function openMovePicker(taskId: string) {
		movePickerTaskId = taskId;
		swipe.close();
	}

	function handleMoveToDay(taskId: string, toDayIndex: number) {
		movePickerTaskId = null;
		onMoveTask?.(taskId, toDayIndex, []);
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
		editingTaskId = taskId;
		editValue = currentTitle;
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
		editingTaskId = null;
		editValue = '';
	}

	// ── Assign picker ────────────────────────────────────
	function toggleAssignPicker(taskId: string) {
		if (assignPickerTaskId === taskId) {
			assignPickerTaskId = null;
		} else {
			assignPickerTaskId = taskId;
		}
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
				{day.tasks.filter((t) => t.completed).length}/{day.tasks.length}
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
		<div
			class="px-4 py-2 border-t"
			style="border-color: #f3f4f6"
		>
			<h4 class="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
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
				{@const offset = swipe.getSwipeOffset(task.id)}
				{@const isSwiping = swipe.swipeState?.itemId === task.id && swipe.swipeState?.locked}
				{@const isRevealed = offset < 0 || swipe.swipedOpenId === task.id}
				{@const isShadow = (task as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
				{@const taskTheme = getTaskTheme(task)}
				{@const taskMember = getTaskMember(task)}
				<div
					animate:flip={{ duration: FLIP_DURATION }}
					class="relative group/task {isShadow ? 'dnd-shadow-item' : ''}
						{assignPickerTaskId === task.id ? 'z-20 overflow-visible' : 'overflow-hidden'}"
					role="listitem"
				>
					<!-- Swipe-reveal zone -->
					{#if isRevealed}
						<div class="absolute inset-y-0 right-0 flex" style="width: {SWIPE_ZONE}px">
							<button
								onclick={() => openMovePicker(task.id)}
								aria-label="Move task: {task.title}"
								class="flex-1 flex items-center justify-center text-white cursor-pointer"
								style="background-color: {THEME.accent}"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
							<button
								onclick={() => handleDeleteSwiped(task.id)}
								aria-label="Delete task: {task.title}"
								class="flex-1 flex items-center justify-center text-white cursor-pointer"
								style="background-color: #ef4444"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
					{/if}

					<!-- Swipeable task content -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="relative bg-white flex items-start w-full pl-1 pr-2 py-1.5 select-none touch-pan-y
							{isSwiping ? '' : 'transition-transform duration-200 ease-out'}"
						style="transform: translateX({offset}px)"
						ontouchstart={(e) => swipe.onTouchStart(e, task.id)}
					>
						<!-- Drag handle -->
						<div class="mt-[4px]"><DragHandle theme={THEME} /></div>

						<!-- Checkbox -->
						<button
							onclick={() => onToggleTask(task.id)}
							role="checkbox"
							aria-checked={task.completed}
							aria-label="Mark {task.title} as {task.completed ? 'incomplete' : 'complete'}"
							class="shrink-0 w-[18px] h-[18px] mt-[3px] rounded-[5px] flex items-center justify-center
								transition-all duration-150 mr-2.5
								{task.completed ? '' : 'border-2 hover:border-opacity-80'}"
							style={task.completed
								? `background-color: ${taskTheme.checkColor}`
								: `border-color: #d1d5db`}
						>
							{#if task.completed}
								<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
									<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							{/if}
						</button>

						<!-- Task title -->
						{#if task.emoji}<span class="mr-0.5 select-none" aria-hidden="true">{task.emoji}</span>{/if}
						<span
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label="Task: {task.title}"
							onfocus={() => startEdit(task.id, task.title)}
							onblur={(e) => {
								const val = (e.currentTarget as HTMLElement).textContent?.trim() ?? '';
								commitEditFromContentEditable(task.id, task.title, val, e.currentTarget as HTMLElement);
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
								if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).textContent = task.title; editingTaskId = null; (e.currentTarget as HTMLElement).blur(); }
							}}
							onpaste={(e) => { e.preventDefault(); const text = e.clipboardData?.getData('text/plain') ?? ''; document.execCommand('insertText', false, text); }}
							class="flex-1 min-w-0 text-base leading-normal outline-none cursor-text wrap-anywhere
								{task.completed ? 'line-through text-gray-400 decoration-gray-300' : 'text-gray-700'}"
						>{task.title}</span>

						<!-- Member badge / assign button -->
						<div class="relative shrink-0 ml-1.5 mt-[2px]">
							{#if task.memberId && taskMember}
								<MemberBadge
									name={taskMember.name}
									theme={taskMember.theme}
									size="sm"
									onclick={() => toggleAssignPicker(task.id)}
								/>
							{:else}
								<MemberBadge unassigned onclick={() => toggleAssignPicker(task.id)} />
							{/if}

							{#if assignPickerTaskId === task.id}
								<AssignPicker
									{members}
									currentMemberId={task.memberId}
									onAssign={(mid) => onAssignTask(task.id, mid)}
									onClose={() => (assignPickerTaskId = null)}
								/>
							{/if}
						</div>

						<!-- Delete icon on hover (desktop) -->
						<button
							onclick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
							aria-label="Delete task: {task.title}"
							class="shrink-0 ml-0.5 w-5 h-5 rounded-md flex items-center justify-center
								opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100
								transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50"
						>
							<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
								<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						</button>
					</div>

					<!-- Move-to-day picker popup -->
					{#if movePickerTaskId === task.id}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex items-center justify-center gap-1.5 px-2"
							onclick={() => (movePickerTaskId = null)}
							onkeydown={(e) => e.key === 'Escape' && (movePickerTaskId = null)}
						>
							<span class="text-[11px] font-medium text-gray-400 mr-1">Move to</span>
							{#each DAY_LABELS as label, i}
								<button
									onclick={(e) => { e.stopPropagation(); handleMoveToDay(task.id, i); }}
									disabled={i === dayIndex}
									class="w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center
										transition-all
										{i === dayIndex
										? 'bg-gray-100 text-gray-300 cursor-default'
										: 'hover:scale-110 text-white cursor-pointer'}"
									style={i !== dayIndex ? `background-color: ${THEME.accent}` : ''}
									aria-label="Move to {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}"
								>
									{label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Add task input -->
		<div class="pl-1 pr-4 py-1.5 flex items-center">
			<span class="shrink-0 w-5" aria-hidden="true"></span>
			<span
				class="shrink-0 w-[18px] h-[18px] rounded-[5px] mr-2.5 border-2 border-dashed opacity-30"
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
</article>

<style>
	:global([aria-grabbed='true']) {
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
