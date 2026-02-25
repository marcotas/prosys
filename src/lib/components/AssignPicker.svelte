<script lang="ts">
	import type { Member } from '$lib/types';
	import MemberBadge from './MemberBadge.svelte';

	let {
		members,
		currentMemberId = null,
		onAssign,
		onClose
	}: {
		members: Member[];
		currentMemberId?: string | null;
		onAssign: (memberId: string | null) => void;
		onClose: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 min-w-[160px]"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	{#each members as member (member.id)}
		{@const isActive = currentMemberId === member.id}
		<button
			onclick={() => { onAssign(member.id); onClose(); }}
			class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors
				{isActive ? 'font-semibold' : 'text-gray-700'}"
		>
			<MemberBadge name={member.name} theme={member.theme} size="sm" />
			<span class="truncate">{member.name}</span>
			{#if isActive}
				<svg class="w-3.5 h-3.5 ml-auto text-green-500 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
					<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			{/if}
		</button>
	{/each}

	{#if currentMemberId}
		<div class="border-t border-gray-100 mt-1 pt-1">
			<button
				onclick={() => { onAssign(null); onClose(); }}
				class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
			>
				<span class="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
					<svg class="w-2.5 h-2.5 text-gray-300" viewBox="0 0 12 12" fill="none" aria-hidden="true">
						<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
				</span>
				<span>Unassign</span>
			</button>
		</div>
	{/if}
</div>
