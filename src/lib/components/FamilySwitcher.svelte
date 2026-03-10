<script lang="ts">
	import { Popover } from 'bits-ui';
	import { CaretDown, Check, House, PencilSimple, Plus } from 'phosphor-svelte';
	import type { Member } from '$lib/types';

	const { members, selectedId, onSelect, onAdd, onEdit } = $props<{
		members: Member[];
		selectedId: string;
		onSelect: (id: string) => void;
		onAdd: () => void;
		onEdit: (member: Member) => void;
	}>();

	const isFamilySelected = $derived(selectedId === '__family__');
	const selectedMember = $derived(members.find((m: Member) => m.id === selectedId));

	let isMobile = $state(false);
	let open = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});
</script>

{#if isMobile}
	<!-- Mobile: Family badge button + separator + Popover dropdown -->
	<nav aria-label="Family members" class="flex items-center gap-1.5 pt-2 pb-1 -mt-2 -mb-1">
		<!-- Family / Planner button -->
		<div class="shrink-0">
			<a
				href={isFamilySelected ? '/' : '/planner'}
				onclick={(e) => {
					if (isFamilySelected) return;
					e.preventDefault();
					onSelect('__family__');
					open = false;
				}}
				aria-current={isFamilySelected ? 'true' : undefined}
				aria-label="Family planner"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
					focus-visible:ring-2 focus-visible:ring-offset-1
					{isFamilySelected
						? 'shadow-sm border-2'
						: 'border-2 border-transparent hover:bg-white/60'}"
				style={isFamilySelected
					? 'background-color: #eef2ff; border-color: #6366f140; color: #312e81; --tw-ring-color: #6366f1'
					: 'color: #6b7280; --tw-ring-color: #6366f1'}
			>
				<span
					class="flex items-center justify-center text-white text-xs font-bold w-7 h-7 rounded-full
						{isFamilySelected ? 'scale-110' : ''}"
					style="background-color: #6366f1"
					aria-hidden="true"
				>
					<House size="14" weight="bold" color="currentColor" />
				</span>
				<span class="hidden sm:inline">Family</span>
			</a>
		</div>

		<!-- Separator -->
		<div class="w-px h-6 bg-gray-200 shrink-0" aria-hidden="true"></div>

		<!-- Member selector Popover -->
		<Popover.Root bind:open>
			<Popover.Trigger
				aria-label={isFamilySelected ? 'Select member' : `Selected: ${selectedMember?.name ?? 'member'}`}
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
					focus-visible:ring-2 focus-visible:ring-offset-1
					{!isFamilySelected && selectedMember
						? 'shadow-sm border-2'
						: 'border-2 border-transparent hover:bg-white/60'}"
				style={!isFamilySelected && selectedMember
					? `background-color: ${selectedMember.theme.accentLight}; border-color: ${selectedMember.theme.accent}40; color: ${selectedMember.theme.accentDark}; --tw-ring-color: ${selectedMember.theme.accent}`
					: 'color: #6b7280; --tw-ring-color: #6366f1'}
			>
				{#if isFamilySelected}
					<span class="font-medium text-gray-500">Members</span>
				{:else if selectedMember}
					{@const isPlayful = selectedMember.theme.variant === 'playful'}
					<span
						class="flex items-center justify-center text-white text-xs font-bold shrink-0
							{isPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'}"
						style="background-color: {selectedMember.theme.accent}"
						aria-hidden="true"
					>
						{#if isPlayful && selectedMember.theme.emoji}
							{selectedMember.theme.emoji}
						{:else}
							{selectedMember.name.charAt(0)}
						{/if}
					</span>
					<span class="truncate max-w-[10ch]">{selectedMember.name}</span>
				{:else}
					<span class="font-medium text-gray-500">Members</span>
				{/if}
				<!-- Chevron down icon -->
				<CaretDown class="w-3.5 h-3.5 shrink-0 text-gray-400" weight="bold" color="currentColor" aria-hidden="true" />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					class="z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[200px]
						data-[state=open]:animate-[popIn_150ms_ease-out]"
					sideOffset={6}
					align="start"
				>
					{#each members as member (member.id)}
						{@const isSelected = selectedId === member.id}
						{@const isPlayful = member.theme.variant === 'playful'}
						<button
							onclick={() => { onSelect(member.id); open = false; }}
							class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors
								{isSelected ? 'font-semibold' : 'text-gray-700'}"
						>
							<!-- Badge -->
							<span
								class="flex items-center justify-center text-white text-xs font-bold shrink-0
									{isPlayful ? 'w-8 h-8 rounded-xl text-base' : 'w-7 h-7 rounded-full'}"
								style="background-color: {member.theme.accent}"
								aria-hidden="true"
							>
								{#if isPlayful && member.theme.emoji}
									{member.theme.emoji}
								{:else}
									{member.name.charAt(0)}
								{/if}
							</span>
							<span class="truncate">{member.name}</span>
							{#if isSelected}
								<span class="ml-auto text-green-500 shrink-0" aria-hidden="true">
									<Check size="14" weight="bold" color="currentColor" />
								</span>
							{/if}
						</button>
					{/each}

					<!-- Divider + Add Profile -->
					<div class="border-t border-gray-100 mt-1 pt-1">
						<button
							onclick={() => { onAdd(); open = false; }}
							class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
						>
							<span class="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0" aria-hidden="true">
								<Plus size="12" color="currentColor" />
							</span>
							<span>Add Profile</span>
						</button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	</nav>
{:else}
	<!-- Desktop: exact existing horizontal scroll row -->
	<nav aria-label="Family members" class="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 -mt-2 -mb-1 pr-1 scrollbar-none">
		<!-- Family / Planner button -->
		<div class="shrink-0">
			<a
				href={isFamilySelected ? '/' : '/planner'}
				onclick={(e) => {
					if (isFamilySelected) return;
					e.preventDefault();
					onSelect('__family__');
				}}
				aria-current={isFamilySelected ? 'true' : undefined}
				aria-label="Family planner"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl
					focus-visible:ring-2 focus-visible:ring-offset-1
					{isFamilySelected
						? 'shadow-sm border-2'
						: 'border-2 border-transparent hover:bg-white/60'}"
				style={isFamilySelected
					? 'background-color: #eef2ff; border-color: #6366f140; color: #312e81; --tw-ring-color: #6366f1'
					: 'color: #6b7280; --tw-ring-color: #6366f1'}
			>
				<span
					class="flex items-center justify-center text-white text-xs font-bold w-7 h-7 rounded-full
						{isFamilySelected ? 'scale-110' : ''}"
					style="background-color: #6366f1"
					aria-hidden="true"
				>
					<House size="14" weight="bold" color="currentColor" />
				</span>
				<span class="hidden sm:inline">Family</span>
			</a>
		</div>

		<!-- Separator -->
		<div class="w-px h-6 bg-gray-200 shrink-0" aria-hidden="true"></div>

		{#each members as member (member.id)}
			{@const isSelected = selectedId === member.id}
			{@const isPlayful = member.theme.variant === 'playful'}
			<div class="relative group shrink-0">
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
					<PencilSimple size="10" weight="bold" color="currentColor" aria-hidden="true" />
				</button>
			</div>
		{/each}

		<!-- Add Profile Button -->
		<button
			onclick={onAdd}
			aria-label="Add family member"
			class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
				text-gray-400 hover:text-gray-600 hover:bg-white/60
				border-2 border-dashed border-gray-200 hover:border-gray-300
				focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400"
		>
			<Plus size="20" color="currentColor" aria-hidden="true" />
			<span class="hidden sm:inline">Add</span>
		</button>
	</nav>
{/if}

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
