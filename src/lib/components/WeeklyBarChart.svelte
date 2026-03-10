<script lang="ts">
	import type { DayData, Task, ThemeConfig } from '$lib/types';
	import { dayAbbreviations } from '$lib/utils/dates';

	const { days, theme } = $props<{ days: DayData[]; theme: ThemeConfig }>();

	const maxTasks = $derived(Math.max(...days.map((d: DayData) => d.tasks.filter((t: Task) => t.status === 'active').length), 1));
	const playful = $derived(theme.variant === 'playful');
</script>

<div class="flex items-end gap-1.5 h-24">
	{#each days as day, i (i)}
		{@const activeTasks = day.tasks.filter((t: Task) => t.status === 'active')}
		{@const total = activeTasks.length}
		{@const completed = activeTasks.filter((t: Task) => t.completed).length}
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
