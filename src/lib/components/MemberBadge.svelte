<script lang="ts">
	import type { ThemeConfig } from '$lib/types';

	const {
		name,
		theme,
		unassigned = false,
		size = 'sm',
		onclick
	}: {
		name?: string;
		theme?: ThemeConfig;
		unassigned?: boolean;
		size?: 'sm' | 'md';
		onclick?: () => void;
	} = $props();

	const isPlayful = $derived(theme?.variant === 'playful');
	const dims = $derived(size === 'md' ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[10px]');
</script>

{#if unassigned && onclick}
	<button
		type="button"
		{onclick}
		title="Assign to a profile"
		class="{dims} rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center
			text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50
			transition-colors cursor-pointer shrink-0"
	>
		<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
			<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round" />
			<circle cx="8.5" cy="7" r="4" />
			<path d="M20 8v6M23 11h-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
{:else if unassigned}
	<span
		title="Assign to a profile"
		class="{dims} rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center
			text-gray-400 shrink-0"
	>
		<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
			<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round" />
			<circle cx="8.5" cy="7" r="4" />
			<path d="M20 8v6M23 11h-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</span>
{:else if onclick}
	<button
		type="button"
		{onclick}
		title={name}
		class="{dims} rounded-full flex items-center justify-center text-white font-bold shrink-0
			hover:scale-110 transition-transform cursor-pointer
			{isPlayful ? 'rounded-lg' : ''}"
		style="background-color: {theme?.accent ?? '#9ca3af'}"
	>
		{#if isPlayful && theme?.emoji}
			<span class="text-[10px]">{theme.emoji}</span>
		{:else}
			{name?.charAt(0) ?? '?'}
		{/if}
	</button>
{:else}
	<span
		title={name}
		class="{dims} rounded-full flex items-center justify-center text-white font-bold shrink-0
			{isPlayful ? 'rounded-lg' : ''}"
		style="background-color: {theme?.accent ?? '#9ca3af'}"
	>
		{#if isPlayful && theme?.emoji}
			<span class="text-[10px]">{theme.emoji}</span>
		{:else}
			{name?.charAt(0) ?? '?'}
		{/if}
	</span>
{/if}
