<script lang="ts">
	import type { DayData, ThemeConfig } from '$lib/data/fake';
	import { dayAbbreviations } from '$lib/data/fake';

	let { days, theme } = $props<{ days: DayData[]; theme: ThemeConfig }>();

	let maxTasks = $derived(Math.max(...days.map((d) => d.tasks.length), 1));
	let playful = $derived(theme.variant === 'playful');
</script>

<div class="flex items-end gap-1.5 h-24">
	{#each days as day, i}
		{@const total = day.tasks.length}
		{@const completed = day.tasks.filter((t) => t.completed).length}
		{@const heightPercent = (total / maxTasks) * 100}
		{@const completedHeight = total > 0 ? (completed / total) * heightPercent : 0}
		<div class="flex-1 flex flex-col items-center gap-1">
			<div class="w-full relative flex flex-col justify-end" style="height: 68px;">
				<div
					class="w-full rounded-sm transition-all duration-500"
					style="height: {heightPercent}%; background-color: {theme.accent}20"
				>
					<div
						class="w-full rounded-sm transition-all duration-500 absolute bottom-0"
						style="height: {completedHeight}%; background-color: {theme.accent}"
					></div>
				</div>
			</div>
			<span
				class="text-[10px] font-medium"
				style="color: {playful ? theme.accent : '#9ca3af'}"
			>
				{dayAbbreviations[i]}
			</span>
		</div>
	{/each}
</div>
