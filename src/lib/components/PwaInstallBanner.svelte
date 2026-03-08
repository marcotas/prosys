<script lang="ts">
	import { Download, Export, X } from 'phosphor-svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'prosys-pwa-banner-dismissed';

	let visible = $state(false);

	onMount(() => {
		// Don't show if already dismissed
		if (localStorage.getItem(STORAGE_KEY)) return;

		// Don't show if already running as a standalone PWA
		if (window.matchMedia('(display-mode: standalone)').matches) return;

		// Only show on mobile/touch devices (likely phones and tablets)
		const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
		if (!isMobile) return;

		// Small delay so it doesn't flash before the page finishes rendering
		const timer = setTimeout(() => { visible = true; }, 1500);
		return () => clearTimeout(timer);
	});

	function dismiss() {
		visible = false;
		localStorage.setItem(STORAGE_KEY, '1');
	}
</script>

{#if browser && visible}
	<div
		class="fixed bottom-0 inset-x-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
			animate-slide-up"
	>
		<div
			class="mx-auto max-w-md bg-white rounded-2xl shadow-lg border border-gray-200
				px-4 py-3 flex items-start gap-3"
		>
			<!-- Icon -->
			<div class="shrink-0 w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600" aria-hidden="true">
				<Download size="20" weight="bold" color="currentColor" />
			</div>

			<!-- Text -->
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold text-gray-900">Install ProSys</p>
				<p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
					Tap <strong>Share</strong>
					<span class="inline-flex items-center align-middle mx-0.5 -mt-0.5 text-gray-400" aria-hidden="true">
						<Export size="12" weight="bold" color="currentColor" />
					</span>
					then <strong>"Add to Home Screen"</strong>
				</p>
			</div>

			<!-- Dismiss button -->
			<button
				onclick={dismiss}
				class="shrink-0 p-1 -mt-0.5 -mr-1 text-gray-400 hover:text-gray-600 transition-colors"
				aria-label="Dismiss"
			>
				<X size="16" weight="bold" color="currentColor" />
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from { transform: translateY(100%); opacity: 0; }
		to   { transform: translateY(0);    opacity: 1; }
	}
	.animate-slide-up {
		animation: slide-up 0.35s ease-out;
	}
</style>
