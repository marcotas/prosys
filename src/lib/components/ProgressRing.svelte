<script lang="ts">
	import { getKidCompletionMessage } from '$lib/data/fake';
	import type { ThemeVariant } from '$lib/data/fake';

	let {
		percent = 0,
		size = 100,
		strokeWidth = 8,
		color = '#4a7c59',
		variant = 'default' as ThemeVariant
	} = $props();

	let radius = $derived((size - strokeWidth) / 2);
	let circumference = $derived(2 * Math.PI * radius);
	let offset = $derived(circumference - (percent / 100) * circumference);

	let playful = $derived(variant === 'playful');
	let kidMessage = $derived(getKidCompletionMessage(percent));
	let fontSize = $derived(playful ? 'text-lg' : 'text-xl');
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
