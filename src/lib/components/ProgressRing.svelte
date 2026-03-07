<script lang="ts">
	import type { ThemeVariant } from '$lib/types';

	const {
		percent = 0,
		size = 100,
		strokeWidth = 8,
		color = '#4a7c59',
		variant = 'default' as ThemeVariant
	} = $props();

	const radius = $derived((size - strokeWidth) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (percent / 100) * circumference);

	const playful = $derived(variant === 'playful');

	function getKidCompletionMessage(pct: number): string {
		if (pct === 100) return 'Perfect! ⭐';
		if (pct >= 80) return 'Amazing! 🎉';
		if (pct >= 60) return 'Great job! 💪';
		if (pct >= 40) return 'Keep going! 🚀';
		if (pct >= 20) return 'Good start! 🌱';
		return "Let's go! 🏁";
	}

	const kidMessage = $derived(getKidCompletionMessage(percent));
	const fontSize = $derived(playful ? 'text-lg' : 'text-xl');
</script>

<div class="flex flex-col items-center gap-1">
	<div class="relative inline-flex items-center justify-center">
		<svg width={size} height={size} class="transform -rotate-90">
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={playful ? `${color}30` : '#e5e7eb'}
				stroke-width={strokeWidth}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={color}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={offset}
				class="transition-all duration-700 ease-out"
			/>
		</svg>
		<span class="absolute {fontSize} font-bold" style="color: {playful ? color : '#1f2937'}">
			{percent}%
		</span>
	</div>
	{#if playful}
		<span class="text-xs font-semibold" style="color: {color}">{kidMessage}</span>
	{/if}
</div>
