<script lang="ts">
	import { slide } from 'svelte/transition';
	import ProgressRing from './ProgressRing.svelte';
	import WeeklyBarChart from './WeeklyBarChart.svelte';
	import type { Member, DayData } from '$lib/types';

	const { member, days } = $props<{ member: Member; days: DayData[] }>();

	const totalTasks = $derived(
		days.reduce((sum: number, d: DayData) => sum + d.tasks.length, 0)
	);
	const totalCompleted = $derived(
		days.reduce(
			(sum: number, d: DayData) =>
				sum +
					d.tasks.filter((t: { completed: boolean }) => t.completed)
						.length,
			0
		)
	);
	const overallPercent = $derived(
		totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0
	);
	const playful = $derived(member.theme.variant === 'playful');

	const STORAGE_KEY = 'prosys-progress-collapsed';
	let collapsed = $state(
		typeof window !== 'undefined' &&
		localStorage.getItem(STORAGE_KEY) === 'true'
	);

	function toggle() {
		collapsed = !collapsed;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, String(collapsed));
		}
	}
</script>

<section
	class="bg-white shadow-sm overflow-hidden flex flex-col
		{playful ? 'rounded-3xl border-2' : 'rounded-2xl border border-gray-200/60'}"
	style={playful ? `border-color: ${member.theme.accent}25` : ''}
	aria-label="Weekly progress overview"
>
	<!-- Header -->
	<button
		onclick={toggle}
		class="w-full text-white px-4 py-2 flex items-center justify-between cursor-pointer hover:brightness-110 transition-all"
		style="background-color: {member.theme.headerBg}"
		aria-expanded={!collapsed}
	>
		<h3 class="font-bold text-sm tracking-wide">
			{playful ? '📊 Overall Progress' : 'Overall Progress'}
		</h3>
		<div class="flex items-center gap-2">
			<span class="text-xs font-medium opacity-80 tabular-nums">
				{totalCompleted}/{totalTasks}
			</span>
			<svg
				class="w-4 h-4 transition-transform duration-200 {collapsed
					? '-rotate-90'
					: ''}"
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
			<!-- Chart + Ring -->
			<div class="px-4 py-4 flex items-center gap-5">
				<div class="flex-1 min-w-0">
					<WeeklyBarChart {days} theme={member.theme} />
				</div>
				<div class="flex-shrink-0">
					<ProgressRing
						percent={overallPercent}
						size={80}
						strokeWidth={7}
						color={member.theme.ringColor}
						variant={member.theme.variant}
					/>
				</div>
			</div>

			<!-- Quote — fills remaining space -->
			<div
				class="mt-auto px-4 py-4 border-t flex items-start gap-3"
				style="border-color: {playful
					? `${member.theme.accent}12`
					: '#f3f4f6'};
					background-color: {playful ? `${member.theme.accentLight}40` : '#fafafa'}"
			>
				<span
					class="text-2xl leading-none flex-shrink-0 -mt-0.5 opacity-30"
					style={playful ? `color: ${member.theme.accent}` : ''}
					aria-hidden="true">{playful ? '💬' : '❝'}</span
				>
				<div class="min-w-0">
					<p
						class="text-[13px] leading-relaxed italic {playful
							? 'font-medium'
							: 'text-gray-500'}"
						style={playful
							? `color: ${member.theme.accentDark}`
							: ''}
					>
						{member.quote.text}
					</p>
					<p
						class="text-xs mt-1 {playful
							? 'font-semibold'
							: 'text-gray-400'}"
						style={playful ? `color: ${member.theme.accent}` : ''}
					>
						— {member.quote.author}
					</p>
				</div>
			</div>
		</div>
	{/if}
</section>
