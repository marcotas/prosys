<script lang="ts">
	import type { Member } from '$lib/types';
	import { Popover, Dialog } from 'bits-ui';
	import { fly, fade } from 'svelte/transition';
	import MemberBadge from './MemberBadge.svelte';

	let {
		members,
		currentMemberId = null,
		onAssign
	}: {
		members: Member[];
		currentMemberId?: string | null;
		onAssign: (memberId: string | null) => void;
	} = $props();

	let open = $state(false);
	let isMobile = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});

	let currentMember = $derived(
		currentMemberId ? members.find((m) => m.id === currentMemberId) : undefined
	);

	function select(memberId: string | null) {
		onAssign(memberId);
		open = false;
	}
</script>

{#snippet checkIcon(size: 'sm' | 'md')}
	<svg class="{size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ml-auto text-green-500 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
		<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

{#snippet unassignIcon(size: number)}
	<span class="w-{size} h-{size} rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
		<svg class="w-{size - 2} h-{size - 2} text-gray-300" viewBox="0 0 12 12" fill="none" aria-hidden="true">
			<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
		</svg>
	</span>
{/snippet}

{#if isMobile}
	<!-- Mobile: Dialog as bottom sheet -->
	<Dialog.Root bind:open>
		<Dialog.Trigger class="shrink-0 cursor-pointer flex">
			{#if currentMember}
				<MemberBadge name={currentMember.name} theme={currentMember.theme} size="sm" />
			{:else}
				<MemberBadge unassigned />
			{/if}
		</Dialog.Trigger>
		<Dialog.Portal>
			<Dialog.Overlay forceMount>
				{#snippet child({ props, open: isOpen })}
					{#if isOpen}
						<div {...props} class="fixed inset-0 z-50 bg-black/40" transition:fade={{ duration: 150 }}></div>
					{/if}
				{/snippet}
			</Dialog.Overlay>
			<Dialog.Content forceMount>
				{#snippet child({ props, open: isOpen })}
					{#if isOpen}
						<div
							{...props}
							class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom,0px)] outline-none"
							transition:fly={{ y: 300, duration: 250 }}
						>
							<!-- Drag handle -->
							<div class="flex justify-center pt-3 pb-1">
								<div class="w-10 h-1 rounded-full bg-gray-300"></div>
							</div>

							<Dialog.Title class="px-5 pb-2 text-sm font-semibold text-gray-500 tracking-wide">
								Assign to&hellip;
							</Dialog.Title>

							<div class="px-2 pb-2">
								{#each members as member (member.id)}
									{@const isActive = currentMemberId === member.id}
									<button
										onclick={() => select(member.id)}
										class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base active:bg-gray-100 transition-colors
											{isActive ? 'font-semibold bg-gray-50' : 'text-gray-700'}"
									>
										<MemberBadge name={member.name} theme={member.theme} size="md" />
										<span class="truncate">{member.name}</span>
										{#if isActive}
											{@render checkIcon('md')}
										{/if}
									</button>
								{/each}

								{#if currentMemberId}
									<div class="border-t border-gray-100 mt-1 pt-1">
										<button
											onclick={() => select(null)}
											class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base text-gray-400 active:bg-gray-100 transition-colors"
										>
											<span class="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
												<svg class="w-3 h-3 text-gray-300" viewBox="0 0 12 12" fill="none" aria-hidden="true">
													<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
												</svg>
											</span>
											<span>Unassign</span>
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/snippet}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<!-- Desktop / tablet: Popover -->
	<Popover.Root bind:open>
		<Popover.Trigger class="shrink-0 cursor-pointer flex">
			{#if currentMember}
				<MemberBadge name={currentMember.name} theme={currentMember.theme} size="sm" />
			{:else}
				<MemberBadge unassigned />
			{/if}
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				class="z-50 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1.5 min-w-[160px]
					data-[state=open]:animate-[popIn_150ms_ease-out]"
				sideOffset={4}
				align="end"
			>
				{#each members as member (member.id)}
					{@const isActive = currentMemberId === member.id}
					<button
						onclick={() => select(member.id)}
						class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors
							{isActive ? 'font-semibold' : 'text-gray-700'}"
					>
						<MemberBadge name={member.name} theme={member.theme} size="sm" />
						<span class="truncate">{member.name}</span>
						{#if isActive}
							{@render checkIcon('sm')}
						{/if}
					</button>
				{/each}

				{#if currentMemberId}
					<div class="border-t border-gray-100 mt-1 pt-1">
						<button
							onclick={() => select(null)}
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
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
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
