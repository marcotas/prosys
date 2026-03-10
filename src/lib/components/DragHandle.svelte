<script lang="ts">
	import { DotsSixVertical } from 'phosphor-svelte';

	const { theme }: { theme?: { accent?: string } } = $props();
</script>

<div
	class="drag-handle shrink-0 flex items-center justify-center w-5 self-stretch cursor-grab active:cursor-grabbing touch-none select-none opacity-30 hover:opacity-60 transition-opacity"
	aria-hidden="true"
>
	<DotsSixVertical size="20" weight="bold" color={theme?.accent ?? '#9ca3af'} />
</div>
