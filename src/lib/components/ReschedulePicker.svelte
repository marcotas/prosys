<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { CaretLeft, CaretRight } from 'phosphor-svelte';
	import { fly, fade, scale } from 'svelte/transition';
	import type { Task } from '$lib/types';
	import {
		getMonthGrid,
		getWeekStartForDate,
		monthLabel,
		isoToDate,
		dateToISO,
		getTodayISO,
		dayAbbreviations
	} from '$lib/utils/dates';

	/* eslint-disable prefer-const */
	let {
		task,
		open = $bindable(false),
		isPastTask = false,
		onReschedule
	}: {
		task: Task | null;
		open: boolean;
		isPastTask?: boolean;
		onReschedule: (toWeekStart: string, toDayIndex: number) => void;
	} = $props();
	/* eslint-enable prefer-const */

	let isMobile = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});

	// Calendar state: start at the task's current month
	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth());

	$effect(() => {
		if (open && task) {
			const d = isoToDate(task.weekStart);
			// Offset to the task's actual day
			d.setDate(d.getDate() + task.dayIndex);
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
		}
	});

	const grid = $derived(getMonthGrid(viewYear, viewMonth));
	const label = $derived(monthLabel(viewYear, viewMonth));
	const todayISO = $derived(getTodayISO());

	// Task's current date for highlighting
	const taskDate = $derived.by(() => {
		if (!task) return '';
		const d = isoToDate(task.weekStart);
		d.setDate(d.getDate() + task.dayIndex);
		return dateToISO(d);
	});

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	function selectDate(d: Date) {
		const weekStart = getWeekStartForDate(d);
		const dayIndex = d.getDay();
		onReschedule(weekStart, dayIndex);
		open = false;
	}

	// Day abbreviations for the header
	const DAY_HEADERS = dayAbbreviations.map((d) => d[0]); // S M T W T F S
</script>

{#snippet calendar()}
	<!-- Month nav -->
	<div class="flex items-center justify-between px-4 pt-3 pb-2">
		<button
			onclick={prevMonth}
			class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-500"
			aria-label="Previous month"
		>
			<CaretLeft class="w-4 h-4" weight="bold" color="currentColor" aria-hidden="true" />
		</button>
		<span class="text-sm font-semibold text-gray-800">{label}</span>
		<button
			onclick={nextMonth}
			class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-500"
			aria-label="Next month"
		>
			<CaretRight class="w-4 h-4" weight="bold" color="currentColor" aria-hidden="true" />
		</button>
	</div>

	<!-- Day-of-week header -->
	<div class="grid grid-cols-7 px-3">
		{#each DAY_HEADERS as d, i (i)}
			<div class="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="px-3 pb-3">
		{#each grid as week, weekIdx (weekIdx)}
			{@const weekHasToday = week.some((d) => d && dateToISO(d) === todayISO)}
			<div class="grid grid-cols-7 {weekHasToday ? 'bg-gray-100 rounded-lg' : ''}">
				{#each week as cell, cellIdx (cellIdx)}
					{#if cell}
						{@const iso = dateToISO(cell)}
						{@const isTaskDay = iso === taskDate}
						{@const isToday = iso === todayISO}
						{@const isPastDate = isPastTask && iso < todayISO}
						<button
							onclick={() => selectDate(cell)}
							disabled={isTaskDay || isPastDate}
							class="relative w-full aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition-colors
								{isTaskDay
									? 'ring-2 ring-indigo-400 font-semibold text-indigo-600 cursor-default'
									: isPastDate
									? 'text-gray-300 cursor-not-allowed'
									: 'hover:bg-gray-200 text-gray-700 cursor-pointer'}"
						>
							{cell.getDate()}
							{#if isToday}
								<span class="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500"></span>
							{/if}
						</button>
					{:else}
						<div></div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div {...props} class="fixed inset-0 z-50 bg-black/40" transition:fade={{ duration: 150 }}></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					{#if isMobile}
						<!-- Mobile: bottom sheet -->
						<div
							{...props}
							class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom,0px)] outline-none"
							transition:fly={{ y: 300, duration: 250 }}
						>
							<div class="flex justify-center pt-3 pb-1">
								<div class="w-10 h-1 rounded-full bg-gray-300"></div>
							</div>
							<Dialog.Title class="px-4 pb-1 text-sm font-semibold text-gray-500 tracking-wide">
								Reschedule
							</Dialog.Title>
							{@render calendar()}
						</div>
					{:else}
						<!-- Desktop: centered dialog -->
						<div
							{...props}
							class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
								bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-[320px] outline-none"
							transition:scale={{ start: 0.95, duration: 150 }}
						>
							<Dialog.Title class="px-4 pt-4 pb-1 text-sm font-semibold text-gray-500 tracking-wide">
								Reschedule
							</Dialog.Title>
							{@render calendar()}
						</div>
					{/if}
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
