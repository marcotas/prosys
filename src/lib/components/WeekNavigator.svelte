<script lang="ts">
	import type { ThemeConfig } from '$lib/data/fake';
	import { formatWeekRange } from '$lib/data/fake';

	let { weekOffset = 0, isTodayWeek = true, theme, onPrev, onNext, onToday } = $props<{
		weekOffset: number;
		isTodayWeek: boolean;
		theme: ThemeConfig;
		onPrev: () => void;
		onNext: () => void;
		onToday: () => void;
	}>();

	let playful = $derived(theme.variant === 'playful');
	let weekLabel = $derived(formatWeekRange(weekOffset));
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
		<svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L9.832 10l2.938 3.71a.75.75 0 11-1.04 1.08l-3.5-4.25a.75.75 0 010-1.08l3.5-4.25a.75.75 0 011.06-.02z" clip-rule="evenodd" />
		</svg>
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
		<svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L10.168 10 7.23 6.29a.75.75 0 111.04-1.08l3.5 4.25a.75.75 0 010 1.08l-3.5 4.25a.75.75 0 01-1.06.02z" clip-rule="evenodd" />
		</svg>
	</button>
</nav>
