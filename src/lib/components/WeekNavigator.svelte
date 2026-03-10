<script lang="ts">
	import { CaretLeft, CaretRight } from 'phosphor-svelte';
	import type { ThemeConfig } from '$lib/types';
	import { formatWeekRange } from '$lib/utils/dates';

	const { weekOffset = 0, isTodayWeek = true, theme, onPrev, onNext, onToday } = $props<{
		weekOffset: number;
		isTodayWeek: boolean;
		theme: ThemeConfig;
		onPrev: () => void;
		onNext: () => void;
		onToday: () => void;
	}>();

	const playful = $derived(theme.variant === 'playful');
	const weekLabel = $derived(formatWeekRange(weekOffset));
</script>

<nav
	class="flex items-center justify-between sm:justify-center gap-1 sm:gap-2 py-2 px-1"
	aria-label="Week navigation"
>
	<!-- Previous week -->
	<button
		onclick={onPrev}
		class="p-2 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer
			{playful ? 'hover:bg-white/50' : 'hover:bg-gray-100'}"
		style={playful ? `color: ${theme.accentDark}` : 'color: #6b7280'}
		aria-label="Previous week"
	>
		<CaretLeft class="w-5 h-5" weight="bold" color="currentColor" aria-hidden="true" />
	</button>

	<!-- Week label + Today button -->
	<div class="flex items-center gap-2.5 min-w-[200px] justify-center">
		<span
			class="text-sm font-semibold tracking-tight tabular-nums select-none"
			style="color: {playful ? theme.accentDark : '#1f2937'}"
		>
			{weekLabel}
		</span>

		{#if !isTodayWeek}
			<button
				onclick={onToday}
				class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-all duration-150
					active:scale-95 cursor-pointer"
				style="background-color: {theme.accent}18; color: {theme.accent}"
				aria-label="Go to current week"
			>
				Today
			</button>
		{/if}
	</div>

	<!-- Next week -->
	<button
		onclick={onNext}
		class="p-2 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer
			{playful ? 'hover:bg-white/50' : 'hover:bg-gray-100'}"
		style={playful ? `color: ${theme.accentDark}` : 'color: #6b7280'}
		aria-label="Next week"
	>
		<CaretRight class="w-5 h-5" weight="bold" color="currentColor" aria-hidden="true" />
	</button>
</nav>
