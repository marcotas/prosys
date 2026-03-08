<script lang="ts">
	import { CaretDown } from 'phosphor-svelte';
	import { slide } from 'svelte/transition';
	import MemberBadge from './MemberBadge.svelte';
	import type { FamilyHabitProgress } from '$lib/types';
	import { dayAbbreviations } from '$lib/utils/dates';

	const { habitProgress }: { habitProgress: FamilyHabitProgress[] } = $props();

	const HEADER_COLOR = '#6366f1';

	const STORAGE_KEY = 'prosys-family-habits-collapsed';
	let collapsed = $state(
		typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
	);

	function toggle() {
		collapsed = !collapsed;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, String(collapsed));
		}
	}

	function getDayProgress(member: FamilyHabitProgress, dayIndex: number): { completed: number; total: number } {
		const total = member.habits.length;
		const completed = member.habits.filter((h) => h.days[dayIndex]).length;
		return { completed, total };
	}

	function getOverallProgress(member: FamilyHabitProgress): number {
		if (member.habits.length === 0) return 0;
		const total = member.habits.length * 7;
		const completed = member.habits.reduce((sum, h) => sum + h.days.filter(Boolean).length, 0);
		return Math.round((completed / total) * 100);
	}

	const totalMembers = $derived(habitProgress.filter((m) => m.habits.length > 0).length);
</script>

<section
	class="bg-white shadow-sm overflow-hidden rounded-2xl border border-gray-200/60"
	aria-label="Family habit progress"
>
	<button
		onclick={toggle}
		class="w-full text-white px-4 py-2 flex items-center justify-between cursor-pointer hover:brightness-110 transition-all"
		style="background-color: {HEADER_COLOR}"
		aria-expanded={!collapsed}
	>
		<h3 class="font-bold text-sm tracking-wide">Habit Progress</h3>
		<div class="flex items-center gap-2">
			{#if totalMembers > 0}
				<span class="text-xs font-medium opacity-80 tabular-nums">
					{totalMembers} {totalMembers === 1 ? 'member' : 'members'}
				</span>
			{/if}
			<span class="transition-transform duration-200 {collapsed ? '-rotate-90' : ''}" aria-hidden="true">
				<CaretDown size="16" weight="bold" color="currentColor" />
			</span>
		</div>
	</button>

	{#if !collapsed}
		<div transition:slide={{ duration: 250 }}>
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b" style="border-color: #f3f4f6">
							<th
								class="text-left pl-4 pr-2 py-2.5 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap sticky left-0 z-10 bg-white text-gray-400"
							>
								Profile
							</th>
							{#each dayAbbreviations as abbr (abbr)}
								<th class="px-1.5 py-2.5 text-[11px] font-semibold text-center uppercase tracking-wide text-gray-400">
									{abbr}
								</th>
							{/each}
							<th class="px-4 py-2.5 text-[11px] font-semibold text-right uppercase tracking-widest whitespace-nowrap text-gray-400">
								Overall
							</th>
						</tr>
					</thead>
					<tbody>
						{#each habitProgress as member (member.memberId)}
							{@const overall = getOverallProgress(member)}
							{@const hasHabits = member.habits.length > 0}
							<tr class="border-b last:border-b-0 hover:bg-gray-50/40 transition-colors" style="border-color: #f9fafb">
								<td class="pl-4 pr-2 py-2.5 sticky left-0 z-10 bg-white">
									<div class="flex items-center gap-2">
										<MemberBadge name={member.memberName} theme={member.theme} size="sm" />
										<span class="text-sm font-medium text-gray-700 whitespace-nowrap">{member.memberName}</span>
									</div>
								</td>

								{#each { length: 7 } as _, dayIdx (dayIdx)}
									{@const dp = getDayProgress(member, dayIdx)}
									<td class="px-1.5 py-2 text-center">
										{#if hasHabits}
											{@const pct = dp.total > 0 ? dp.completed / dp.total : 0}
											{@const ringSize = 28}
											{@const sw = 3}
											{@const r = (ringSize - sw) / 2}
											{@const circ = 2 * Math.PI * r}
											{@const dashOffset = circ - pct * circ}
											<div class="flex items-center justify-center" title="{dp.completed}/{dp.total} habits">
												<div class="relative inline-flex items-center justify-center">
													<svg width={ringSize} height={ringSize} class="transform -rotate-90">
														<circle
															cx={ringSize / 2} cy={ringSize / 2} r={r}
															fill="none" stroke="#e5e7eb" stroke-width={sw}
														/>
														{#if dp.completed > 0}
															<circle
																cx={ringSize / 2} cy={ringSize / 2} r={r}
																fill="none"
																stroke={member.theme.accent}
																stroke-width={sw}
																stroke-linecap="round"
																stroke-dasharray={circ}
																stroke-dashoffset={dashOffset}
																class="transition-all duration-500"
															/>
														{/if}
													</svg>
													<span class="absolute text-[8px] font-bold" style="color: {dp.completed === dp.total && dp.total > 0 ? member.theme.accent : '#9ca3af'}">
														{dp.completed}
													</span>
												</div>
											</div>
										{:else}
											<span class="text-gray-200 text-xs">—</span>
										{/if}
									</td>
								{/each}

								<td class="px-4 py-2 text-right">
									{#if hasHabits}
										<div class="flex items-center justify-end gap-2">
											<div
												class="w-16 h-[5px] rounded-full overflow-hidden"
												style="background-color: {overall === 100 ? `${member.theme.accent}30` : '#f0f0f0'}"
												role="progressbar"
												aria-valuenow={overall}
												aria-valuemin={0}
												aria-valuemax={100}
											>
												<div
													class="h-full rounded-full transition-all duration-500"
													style="width: {overall}%; background-color: {member.theme.accent}"
												></div>
											</div>
											{#if overall === 100}
												<span class="text-sm w-8 text-right">🏆</span>
											{:else}
												<span class="text-xs font-semibold w-8 text-right tabular-nums text-gray-500">
													{overall}%
												</span>
											{/if}
										</div>
									{:else}
										<span class="text-xs text-gray-300">No habits</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if habitProgress.length === 0}
				<div class="flex flex-col items-center justify-center py-6 text-center px-4">
					<span class="text-2xl mb-2" aria-hidden="true">📊</span>
					<p class="text-sm font-medium text-gray-400">No family members yet</p>
				</div>
			{/if}
		</div>
	{/if}
</section>
