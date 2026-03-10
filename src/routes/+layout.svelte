<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import { useNotifier } from '$lib/adapters/svelte';
	import PwaInstallBanner from '$lib/components/PwaInstallBanner.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import { wsClient, offlineQueue } from '$lib/infra';

	const { children } = $props();

	// ── Update notifications ────────────────────────────
	let tauriUpdate = $state<{ version: string; download: () => Promise<void> } | null>(null);
	let tauriUpdateDismissed = $state(false);
	let swUpdateAvailable = $state(false);
	let swUpdateDismissed = $state(false);

	// ── Reactive bridges for framework-agnostic infra ────
	const ws = useNotifier(wsClient);
	const oq = useNotifier(offlineQueue);

	// ── Hydration signal for e2e tests ───────────────────
	let hydrated = $state(false);

	// ── WebSocket lifecycle ──────────────────────────────
	onMount(() => {
		hydrated = true;
		offlineQueue.init();
		wsClient.connect();

		// Show the Tauri window now that the UI has hydrated.
		// The window starts hidden ("visible": false in tauri.conf.json) to
		// avoid flashing a blank page or "file not found" error while the
		// Node.js server starts up.
		if ('__TAURI_INTERNALS__' in window) {
			(window as Window & { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<void> } }).__TAURI_INTERNALS__.invoke('show_main_window');
		}

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

		return () => wsClient.destroy();
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
						await (window as Window & { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<void> } }).__TAURI_INTERNALS__.invoke('kill_server');
						await relaunch();
					}
				};
			}
		} catch (e) {
			console.warn('[prosys] Update check failed:', e);
		}
	}

	// ── Connection status ────────────────────────────────
	const statusLabel = $derived(
		$ws.syncing
			? 'Syncing...'
			: $ws.connected
			? $oq.pendingCount > 0
				? `${$oq.pendingCount} pending`
				: ''
			: 'Offline'
	);

	const statusTitle = $derived(
		$ws.syncing
			? 'Syncing offline changes...'
			: $ws.connected
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

<Toaster position="bottom-center" />

<div class="min-h-screen bg-gray-50" data-hydrated={hydrated || undefined}>
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
		class:text-gray-500={$ws.connected && !$ws.syncing}
		class:text-amber-600={!$ws.connected || $ws.syncing}
		title={statusTitle}
	>
		<span
			class="w-2 h-2 rounded-full transition-colors duration-300"
			class:bg-emerald-500={$ws.connected && !$ws.syncing && $oq.pendingCount === 0}
			class:bg-amber-400={$ws.connected && !$ws.syncing && $oq.pendingCount > 0}
			class:bg-amber-500={$ws.syncing}
			class:bg-red-400={!$ws.connected && !$ws.syncing}
			class:animate-pulse={!$ws.connected || $ws.syncing}
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
