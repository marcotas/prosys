<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Toaster } from 'svelte-sonner';
	import { wsStore } from '$lib/stores/ws.svelte';
	import { taskStore } from '$lib/stores/tasks.svelte';
	import { habitStore } from '$lib/stores/habits.svelte';
	import { memberStore } from '$lib/stores/members.svelte';
	import { offlineQueue } from '$lib/stores/offline-queue.svelte';
	import type { Task, Habit, Member } from '$lib/types';
	import PwaInstallBanner from '$lib/components/PwaInstallBanner.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();

	// ── Update notifications ────────────────────────────
	let tauriUpdate = $state<{ version: string; download: () => Promise<void> } | null>(null);
	let tauriUpdateDismissed = $state(false);
	let swUpdateAvailable = $state(false);
	let swUpdateDismissed = $state(false);

	// ── WebSocket lifecycle ──────────────────────────────
	onMount(() => {
		wsStore.init();

		// Show the Tauri window now that the UI has hydrated.
		// The window starts hidden ("visible": false in tauri.conf.json) to
		// avoid flashing a blank page or "file not found" error while the
		// Node.js server starts up.
		if ('__TAURI_INTERNALS__' in window) {
			(window as any).__TAURI_INTERNALS__.invoke('show_main_window');
		}

		// Register WS message handlers → store apply methods
		const unsubs = [
			wsStore.onMessage('task:created', (p: Task) => taskStore.applyRemoteCreate(p)),
			wsStore.onMessage('task:updated', (p: Task) => taskStore.applyRemoteUpdate(p)),
			wsStore.onMessage('task:deleted', (p: { id: string; memberId: string | null; weekStart: string; dayIndex: number }) => taskStore.applyRemoteDelete(p)),
			wsStore.onMessage('task:reordered', (p: { memberId: string | null; weekStart: string; dayIndex: number; taskIds: string[] }) => taskStore.applyRemoteReorder(p)),
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

		// ── Tauri updater (desktop only) ────────────────────
		// Tauri v2 injects __TAURI_INTERNALS__ (not __TAURI__) into the WebView
		if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
			checkTauriUpdate();
		}

		// ── PWA update detection (mobile only) ──────────────
		if ('serviceWorker' in navigator) {
			// Track whether we already have a controller — if not, the first
			// controllerchange is the initial SW activation, not an update.
			let hadController = !!navigator.serviceWorker.controller;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (hadController) {
					swUpdateAvailable = true;
				} else {
					hadController = true;
				}
			});
		}

		return () => {
			unsubs.forEach((fn) => fn());
			wsStore.destroy();
		};
	});

	async function checkTauriUpdate() {
		try {
			const { check } = await import('@tauri-apps/plugin-updater');
			const { relaunch } = await import('@tauri-apps/plugin-process');

			const update = await check();
			if (update) {
				tauriUpdate = {
					version: update.version,
					download: async () => {
						await update.downloadAndInstall();
						// Kill the Node.js server before relaunch — relaunch() calls
						// process::exit() which orphans child processes.
						await (window as any).__TAURI_INTERNALS__.invoke('kill_server');
						await relaunch();
					}
				};
			}
		} catch (e) {
			console.warn('[prosys] Update check failed:', e);
		}
	}

	// ── Connection status ────────────────────────────────
	let statusLabel = $derived(
		wsStore.syncing
			? 'Syncing...'
			: wsStore.connected
				? offlineQueue.pendingCount > 0
					? `${offlineQueue.pendingCount} pending`
					: ''
				: 'Offline'
	);

	let statusTitle = $derived(
		wsStore.syncing
			? 'Syncing offline changes...'
			: wsStore.connected
				? 'Real-time sync active'
				: 'Server unreachable — changes saved locally'
	);
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<Toaster position="top-center" richColors closeButton />

<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>

<!-- PWA install banner (mobile browsers only) -->
<PwaInstallBanner />

<!-- Update banners -->
{#if browser && tauriUpdate && !tauriUpdateDismissed}
	<UpdateBanner
		message="Update available"
		detail="Version {tauriUpdate.version} is ready"
		actionLabel="Update & restart"
		onAction={tauriUpdate.download}
		onDismiss={() => tauriUpdateDismissed = true}
	/>
{/if}

{#if browser && swUpdateAvailable && !swUpdateDismissed}
	<UpdateBanner
		message="New version available"
		actionLabel="Refresh"
		onAction={() => window.location.reload()}
		onDismiss={() => swUpdateDismissed = true}
	/>
{/if}

<!-- Connection indicator -->
{#if browser}
	<div
		class="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full
			bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200/60 text-xs
			transition-opacity duration-300"
		class:text-gray-500={wsStore.connected && !wsStore.syncing}
		class:text-amber-600={!wsStore.connected || wsStore.syncing}
		title={statusTitle}
	>
		<span
			class="w-2 h-2 rounded-full transition-colors duration-300"
			class:bg-emerald-500={wsStore.connected && !wsStore.syncing && offlineQueue.pendingCount === 0}
			class:bg-amber-400={wsStore.connected && !wsStore.syncing && offlineQueue.pendingCount > 0}
			class:bg-amber-500={wsStore.syncing}
			class:bg-red-400={!wsStore.connected && !wsStore.syncing}
			class:animate-pulse={!wsStore.connected || wsStore.syncing}
		></span>
		{#if statusLabel}
			<span>{statusLabel}</span>
		{/if}
		<span class="sr-only">{statusTitle}</span>
	</div>
{/if}

<!-- App version -->
<footer class="py-4 text-center text-xs text-gray-300">
	&copy; {new Date().getFullYear()} ProSys &middot; v{__APP_VERSION__}
</footer>
