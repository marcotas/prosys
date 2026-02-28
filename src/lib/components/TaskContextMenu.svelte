<script lang="ts">
	import { ContextMenu } from 'bits-ui';

	let {
		onReschedule,
		onDelete,
		children
	}: {
		onReschedule: () => void;
		onDelete: () => void;
		children: import('svelte').Snippet;
	} = $props();
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
			<ContextMenu.Item
				onSelect={onReschedule}
				class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg mx-1 cursor-default transition-colors"
			>
				<span aria-hidden="true">📅</span> Reschedule…
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={onDelete}
				class="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg mx-1 cursor-default transition-colors"
			>
				<span aria-hidden="true">🗑</span> Delete
			</ContextMenu.Item>
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
