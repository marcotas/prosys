<script lang="ts">
	import { slide } from 'svelte/transition';
	import ProgressRing from './ProgressRing.svelte';
	import WeeklyBarChart from './WeeklyBarChart.svelte';
	import type { DayData } from '$lib/types';

	const { days } = $props<{ days: DayData[] }>();

	const totalTasks = $derived(
		days.reduce((sum: number, d: DayData) => sum + d.tasks.length, 0)
	);
	const totalCompleted = $derived(
		days.reduce((sum: number, d: DayData) => sum + d.tasks.filter((t: { completed: boolean }) => t.completed).length, 0)
	);
	const overallPercent = $derived(
		totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0
	);

	const FAMILY_THEME = {
		variant: 'default' as const,
		accent: '#6366f1',
		accentLight: '#eef2ff',
		accentDark: '#312e81',
		headerBg: '#6366f1',
		ringColor: '#6366f1',
		checkColor: '#6366f1',
		emoji: ''
	};

	const STORAGE_KEY = 'prosys-family-progress-collapsed';
	let collapsed = $state(
		typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
	);

	function toggle() {
		collapsed = !collapsed;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, String(collapsed));
		}
	}
</script>

<section
	class="bg-white shadow-sm overflow-hidden flex flex-col rounded-2xl border border-gray-200/60"
	aria-label="Family weekly progress"
>
	<button
		onclick={toggle}
		class="w-full text-white px-4 py-2 flex items-center justify-between cursor-pointer hover:brightness-110 transition-all"
		style="background-color: {FAMILY_THEME.headerBg}"
		aria-expanded={!collapsed}
	>
		<h3 class="font-bold text-sm tracking-wide">Family Progress</h3>
		<div class="flex items-center gap-2">
			<span class="text-xs font-medium opacity-80 tabular-nums">
				{totalCompleted}/{totalTasks}
			</span>
			<svg
				class="w-4 h-4 transition-transform duration-200 {collapsed ? '-rotate-90' : ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
	</button>

	{#if !collapsed}
		<div transition:slide={{ duration: 250 }}>
			<div class="px-4 py-4 flex items-center gap-5">
				<div class="flex-1 min-w-0">
					<WeeklyBarChart {days} theme={FAMILY_THEME} />
				</div>
				<div class="shrink-0">
					<ProgressRing
						percent={overallPercent}
						size={80}
						strokeWidth={7}
						color={FAMILY_THEME.ringColor}
						variant="default"
					/>
				</div>
			</div>
		</div>
	{/if}
</section>
