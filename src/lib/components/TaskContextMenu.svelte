<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank.svelte';
	import Prohibit from 'phosphor-svelte/lib/Prohibit.svelte';
	import Trash from 'phosphor-svelte/lib/Trash.svelte';
	import type { Snippet } from 'svelte';

	const {
		onReschedule,
		onDelete,
		isPast = false,
		isCancelled = false,
		isRescheduled = false,
		children
	}: {
		onReschedule: () => void;
		onDelete: () => void;
		isPast?: boolean;
		isCancelled?: boolean;
		isRescheduled?: boolean;
		children: Snippet;
	} = $props();

	const hideActions = $derived(isCancelled || isRescheduled);
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger class="contents">
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content
			class="z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[160px]
				data-[state=open]:animate-[popIn_150ms_ease-out]"
		>
			{#if !hideActions}
				<ContextMenu.Item
					onSelect={onReschedule}
					class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg mx-1 cursor-default transition-colors"
				>
					<span aria-hidden="true"><CalendarBlank size="16" color="currentColor" /></span> Reschedule…
				</ContextMenu.Item>
			{/if}
			{#if !hideActions}
				<ContextMenu.Item
					onSelect={onDelete}
					class="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg mx-1 cursor-default transition-colors"
				>
					<span aria-hidden="true">{#if isPast}<Prohibit size="16" color="currentColor" />{:else}<Trash size="16" color="currentColor" />{/if}</span> {isPast ? 'Cancel' : 'Delete'}
				</ContextMenu.Item>
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>

<style>
	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
