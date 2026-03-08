<script lang="ts">
	import { UserCircle } from 'phosphor-svelte';
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
		<UserCircle size="12" weight="bold" color="currentColor" aria-hidden="true" />
	</button>
{:else if unassigned}
	<span
		title="Assign to a profile"
		class="{dims} rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center
			text-gray-400 shrink-0"
	>
		<UserCircle size="12" weight="bold" color="currentColor" aria-hidden="true" />
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
