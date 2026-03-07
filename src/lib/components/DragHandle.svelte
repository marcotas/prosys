<script lang="ts">
	import { dragHandle } from 'svelte-dnd-action';

	const { theme }: { theme?: { accent?: string } } = $props();
</script>

<div
	use:dragHandle
	class="drag-handle shrink-0 flex items-center justify-center w-5 self-stretch cursor-grab active:cursor-grabbing touch-none select-none opacity-30 hover:opacity-60 transition-opacity"
	aria-hidden="true"
>
	<svg
		width="8"
		height="14"
		viewBox="0 0 8 14"
		fill={theme?.accent ?? '#9ca3af'}
	>
		<!-- 6-dot grip pattern (2 columns x 3 rows) -->
		<circle cx="2" cy="2" r="1.2" />
		<circle cx="6" cy="2" r="1.2" />
		<circle cx="2" cy="7" r="1.2" />
		<circle cx="6" cy="7" r="1.2" />
		<circle cx="2" cy="12" r="1.2" />
		<circle cx="6" cy="12" r="1.2" />
	</svg>
</div>
