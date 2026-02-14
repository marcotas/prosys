<script lang="ts">
	import type { Member } from '$lib/types';

	let { members, selectedId, onSelect, onAdd, onEdit } = $props<{
		members: Member[];
		selectedId: string;
		onSelect: (id: string) => void;
		onAdd: () => void;
		onEdit: (member: Member) => void;
	}>();
</script>

<nav aria-label="Family members" class="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 -mt-2 -mb-1 pr-1 scrollbar-none">
	{#each members as member (member.id)}
		{@const isSelected = selectedId === member.id}
		{@const isPlayful = member.theme.variant === 'playful'}
		<div class="relative group flex-shrink-0">
			<button
				onclick={() => onSelect(member.id)}
				aria-current={isSelected ? 'true' : undefined}
				aria-label="View {member.name}'s dashboard"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
					focus-visible:ring-2 focus-visible:ring-offset-1
					{isSelected
					? 'shadow-sm border-2'
					: 'border-2 border-transparent hover:bg-white/60'}"
				style={isSelected
					? `background-color: ${member.theme.accentLight}; border-color: ${member.theme.accent}40; color: ${member.theme.accentDark}; --tw-ring-color: ${member.theme.accent}`
					: `color: #6b7280; --tw-ring-color: ${member.theme.accent}`}
			>
				<span
					class="flex items-center justify-center text-white text-xs font-bold
						{isPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'}
						{isSelected ? 'scale-110' : ''}"
					style="background-color: {member.theme.accent}"
					aria-hidden="true"
				>
					{#if isPlayful && member.theme.emoji}
						{member.theme.emoji}
					{:else}
						{member.name.charAt(0)}
					{/if}
				</span>
				<span class="hidden sm:inline">{member.name}</span>
			</button>
			<!-- Edit button on hover -->
			<button
				onclick={(e) => { e.stopPropagation(); onEdit(member); }}
				aria-label="Edit {member.name}'s profile"
				class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-500 text-white
					flex items-center justify-center opacity-0 group-hover:opacity-100
					hover:bg-gray-700 shadow-sm focus-visible:opacity-100
					focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-500"
			>
				<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>
	{/each}

	<!-- Add Profile Button -->
	<button
		onclick={onAdd}
		aria-label="Add family member"
		class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
			text-gray-400 hover:text-gray-600 hover:bg-white/60
			border-2 border-dashed border-gray-200 hover:border-gray-300
			focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400"
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		<span class="hidden sm:inline">Add</span>
	</button>
</nav>
