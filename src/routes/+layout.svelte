<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { wsStore } from '$lib/stores/ws.svelte';
	import { taskStore } from '$lib/stores/tasks.svelte';
	import { habitStore } from '$lib/stores/habits.svelte';
	import { memberStore } from '$lib/stores/members.svelte';
	import type { Task, Habit, Member } from '$lib/types';
	import PwaInstallBanner from '$lib/components/PwaInstallBanner.svelte';

	let { children } = $props();

	// ── WebSocket lifecycle ──────────────────────────────
	onMount(() => {
		wsStore.init();

		// Register WS message handlers → store apply methods
		const unsubs = [
			wsStore.onMessage('task:created', (p: Task) => taskStore.applyRemoteCreate(p)),
			wsStore.onMessage('task:updated', (p: Task) => taskStore.applyRemoteUpdate(p)),
			wsStore.onMessage('task:deleted', (p: { id: string; memberId: string; weekStart: string; dayIndex: number }) => taskStore.applyRemoteDelete(p)),
			wsStore.onMessage('task:reordered', (p: { memberId: string; weekStart: string; dayIndex: number; taskIds: string[] }) => taskStore.applyRemoteReorder(p)),
			wsStore.onMessage('task:moved', (p: { task: Task; fromDay: number }) => taskStore.applyRemoteMove(p)),
			wsStore.onMessage('habit:created', (p: Habit) => habitStore.applyRemoteCreate(p)),
			wsStore.onMessage('habit:updated', (p: Habit) => habitStore.applyRemoteUpdate(p)),
			wsStore.onMessage('habit:deleted', (p: { id: string; memberId: string }) => habitStore.applyRemoteDelete(p)),
			wsStore.onMessage('habit:toggled', (p: { habitId: string; weekStart: string; dayIndex: number; completed: boolean }) => habitStore.applyRemoteToggle(p)),
			wsStore.onMessage('habit:reordered', (p: { memberId: string; habitIds: string[] }) => habitStore.applyRemoteReorder(p)),
			wsStore.onMessage('member:created', (p: Member) => memberStore.applyRemoteCreate(p)),
			wsStore.onMessage('member:updated', (p: Member) => memberStore.applyRemoteUpdate(p)),
			wsStore.onMessage('member:deleted', (p: { id: string }) => memberStore.applyRemoteDelete(p)),
		];

		return () => {
			unsubs.forEach((fn) => fn());
			wsStore.destroy();
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>

<!-- PWA install banner (mobile browsers only) -->
<PwaInstallBanner />

<!-- Connection indicator -->
{#if browser}
	<div
		class="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full
			bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200/60 text-xs text-gray-500
			transition-opacity duration-300"
		title={wsStore.connected ? 'Real-time sync active' : 'Reconnecting...'}
	>
		<span
			class="w-2 h-2 rounded-full transition-colors duration-300"
			class:bg-emerald-500={wsStore.connected}
			class:bg-gray-300={!wsStore.connected}
			class:animate-pulse={!wsStore.connected}
		></span>
		<span class="sr-only">{wsStore.connected ? 'Connected' : 'Disconnected'}</span>
	</div>
{/if}
