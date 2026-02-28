<script lang="ts">
	import type { Member, DayData, PlannerTask, ThemeConfig } from '$lib/types';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		computeWeekDays,
		getWeekStart,
		getTodayWeekOffset,
		getTodayISO
	} from '$lib/utils/dates';
	import { memberStore } from '$lib/stores/members.svelte';
	import { taskStore } from '$lib/stores/tasks.svelte';
	import { habitStore } from '$lib/stores/habits.svelte';
	import { wsStore } from '$lib/stores/ws.svelte';
	import FamilySwitcher from '$lib/components/FamilySwitcher.svelte';
	import WeekNavigator from '$lib/components/WeekNavigator.svelte';
	import FamilyProgress from '$lib/components/FamilyProgress.svelte';
	import FamilyHabitTracker from '$lib/components/FamilyHabitTracker.svelte';
	import PlannerDayCard from '$lib/components/PlannerDayCard.svelte';
	import ProfileDialog from '$lib/components/ProfileDialog.svelte';

	let { data } = $props();

	// Hydrate stores
	$effect(() => {
		if (data.members.length > 0) {
			untrack(() => {
				memberStore.hydrate(data.members, data.members[0].id);
				taskStore.hydrateFamilyWeek(data.weekStart, data.tasks);
				habitStore.hydrateFamilyWeek(data.weekStart, data.habitProgress);
			});
		}
	});

	let dialogOpen = $state(false);
	let editingMember = $state<Member | null>(null);
	let weekOffset = $state(getTodayWeekOffset());

	let todayOffset = $derived(getTodayWeekOffset());
	let isTodayWeek = $derived(weekOffset === todayOffset);
	let currentWeekStart = $derived(getWeekStart(weekOffset));
	let todayISO = $derived(getTodayISO());

	const PLANNER_THEME: ThemeConfig = {
		variant: 'default',
		accent: '#6366f1',
		accentLight: '#eef2ff',
		accentDark: '#312e81',
		headerBg: '#6366f1',
		ringColor: '#6366f1',
		checkColor: '#6366f1',
		emoji: ''
	};

	// Scroll container
	let scrollContainer = $state<HTMLDivElement>(undefined as unknown as HTMLDivElement);

	$effect(() => {
		if (!scrollContainer || !isTodayWeek) return;
		if (scrollContainer.scrollWidth <= scrollContainer.clientWidth) return;
		const todayCard = scrollContainer.querySelector(`[data-iso="${todayISO}"]`);
		if (todayCard) {
			requestAnimationFrame(() => {
				todayCard.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
			});
		}
	});

	// Mouse drag-to-scroll
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragScrollLeft = 0;

	function onDragPointerDown(e: PointerEvent) {
		if (e.pointerType === 'touch' || e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('button, input, a, [contenteditable], [draggable], .drag-handle')) return;
		isDragging = true;
		dragStartX = e.clientX;
		dragScrollLeft = scrollContainer.scrollLeft;
		scrollContainer.classList.add('is-dragging');
		scrollContainer.style.cursor = 'grabbing';
		scrollContainer.style.userSelect = 'none';
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
		scrollContainer.classList.remove('is-dragging');
		scrollContainer.style.cursor = '';
		scrollContainer.style.userSelect = '';
	}

	// ── Load family tasks/habits when week changes ──
	$effect(() => {
		const weekStart = currentWeekStart;
		taskStore.loadFamilyWeek(weekStart);
	});

	$effect(() => {
		const weekStart = currentWeekStart;
		habitStore.loadFamilyWeek(weekStart);
	});

	// ── Sync callback ──
	$effect(() => {
		const weekStart = currentWeekStart;
		return wsStore.onSync(async () => {
			await memberStore.load();
			await taskStore.reloadFamilyWeek(weekStart);
			await habitStore.reloadFamilyWeek(weekStart);
		});
	});

	// ── Build days from family tasks ──
	let members = $derived(
		memberStore.members.length > 0 ? memberStore.members : data.members
	);

	let visibleDays = $derived.by(() => {
		const weekStart = currentWeekStart;
		const storeTasks = computeWeekDays(weekOffset).map((d, i) => ({
			dayName: d.dayName,
			date: d.date,
			isoDate: d.isoDate,
			tasks: taskStore.getFamilyTasksForDay(weekStart, i)
		}));
		const hasStoreTasks = storeTasks.some((d) => d.tasks.length > 0);
		if (hasStoreTasks) return storeTasks;
		// SSR fallback
		return computeWeekDays(weekOffset).map((d, i) => ({
			dayName: d.dayName,
			date: d.date,
			isoDate: d.isoDate,
			tasks: data.tasks.filter((t: PlannerTask) => t.dayIndex === i)
		}));
	});

	let visibleHabitProgress = $derived.by(() => {
		const weekStart = currentWeekStart;
		const storeData = habitStore.getFamilyHabitProgress(weekStart);
		if (storeData.length > 0) return storeData;
		return data.habitProgress;
	});

	// ── Reschedule (cross-week move) ──
	function rescheduleTask(taskId: string, toWeekStart: string, toDayIndex: number) {
		taskStore.moveToDate(taskId, toWeekStart, toDayIndex);
	}

	// ── Task operations ──
	function toggleTask(taskId: string) {
		taskStore.toggle(taskId);
	}

	function addTask(dayIndex: number, title: string, emoji?: string) {
		taskStore.create({
			weekStart: currentWeekStart,
			dayIndex,
			title,
			emoji
		});
	}

	function deleteTask(taskId: string) {
		taskStore.delete(taskId);
	}

	function updateTask(taskId: string, updates: { title?: string; emoji?: string }) {
		taskStore.update(taskId, updates);
	}

	function assignTask(taskId: string, memberId: string | null) {
		taskStore.assignTask(taskId, memberId);
	}

	function reorderTasks(dayIndex: number, taskIds: string[]) {
		taskStore.reorder(null as any, currentWeekStart, dayIndex, taskIds);
	}

	async function moveTask(taskId: string, toDayIndex: number, orderedTaskIds: string[]) {
		await taskStore.moveToDay(taskId, toDayIndex);
		if (orderedTaskIds.length > 0) {
			await taskStore.reorder(null as any, currentWeekStart, toDayIndex, orderedTaskIds);
		}
	}

	// ── Profile dialog ──
	function openCreateDialog() {
		editingMember = null;
		dialogOpen = true;
	}

	function openEditDialog(member: Member) {
		editingMember = member;
		dialogOpen = true;
	}

	async function handleSave(saveData: { name: string; theme: ThemeConfig; quote: { text: string; author: string } }) {
		if (editingMember) {
			await memberStore.update(editingMember.id, saveData);
		} else {
			await memberStore.create(saveData);
		}
	}

	async function handleDelete(id: string) {
		await memberStore.delete(id);
	}
</script>

<div class="min-h-screen">
	<div class="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
		<!-- Header -->
		<header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 rounded-xl flex items-center justify-center"
					style="background-color: {PLANNER_THEME.accent}"
					aria-hidden="true"
				>
					<svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round" />
						<polyline points="9 22 9 12 15 12 15 22" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</div>
				<div>
					<h1 class="text-2xl font-bold leading-tight text-gray-900">Family Planner</h1>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<FamilySwitcher
					{members}
					selectedId="__family__"
					onSelect={(id) => {
						if (id !== '__family__') {
							memberStore.select(id);
							goto('/');
						}
					}}
					onAdd={openCreateDialog}
					onEdit={openEditDialog}
				/>
				<a
					href="/connect"
					class="flex items-center justify-center w-9 h-9 rounded-lg
						bg-white border border-gray-200 text-gray-400 hover:text-indigo-600
						hover:border-indigo-300 transition-colors shadow-sm"
					title="Connect a device"
				>
					<svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="2" width="8" height="8" rx="1" />
						<rect x="14" y="2" width="8" height="8" rx="1" />
						<rect x="2" y="14" width="8" height="8" rx="1" />
						<rect x="14" y="14" width="4" height="4" rx="1" />
						<path d="M22 14h-4v4" /><path d="M22 22h-4v-4" /><path d="M18 22h4" />
					</svg>
				</a>
			</div>
		</header>

		<!-- Week Navigator -->
		<WeekNavigator
			{weekOffset}
			{isTodayWeek}
			theme={PLANNER_THEME}
			onPrev={() => weekOffset--}
			onNext={() => weekOffset++}
			onToday={() => (weekOffset = todayOffset)}
		/>

		<!-- Stats Row -->
		<div class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 mb-6 items-start">
			<FamilyProgress days={visibleDays} />
			<FamilyHabitTracker habitProgress={visibleHabitProgress} />
		</div>
	</div>

	<!-- Day Cards -->
	<section aria-label="Daily tasks" class="pb-4 sm:pb-6">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={scrollContainer}
			class="flex gap-4 overflow-x-auto scroll-smooth snap-x
				max-[479px]:snap-mandatory min-[480px]:snap-proximity
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
					<PlannerDayCard
						{day}
						{dayIndex}
						{isToday}
						{members}
						onToggleTask={(taskId) => toggleTask(taskId)}
						onAddTask={(title, emoji) => addTask(dayIndex, title, emoji)}
						onDeleteTask={(taskId) => deleteTask(taskId)}
						onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
						onAssignTask={(taskId, mid) => assignTask(taskId, mid)}
						onReorderTasks={(taskIds) => reorderTasks(dayIndex, taskIds)}
						onMoveTask={moveTask}
						onRescheduleTask={rescheduleTask}
					/>
				</div>
			{/each}
		</div>
	</section>
</div>

<ProfileDialog
	open={dialogOpen}
	member={editingMember}
	onSave={handleSave}
	onDelete={handleDelete}
	onClose={() => (dialogOpen = false)}
/>
