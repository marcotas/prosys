<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import QRCode from 'qrcode';

	let qrDataUrl = $state('');
	let connectUrl = $state('');
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/server-info');
			if (!res.ok) throw new Error('Failed to fetch server info');
			const { ip, port } = await res.json();

			connectUrl = `http://${ip}:${port}`;
			qrDataUrl = await QRCode.toDataURL(connectUrl, {
				width: 280,
				margin: 2,
				color: { dark: '#111827', light: '#ffffff' }
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not generate QR code';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Connect a Device - ProSys</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-8">
	<div class="w-full max-w-sm text-center space-y-6">
		<!-- Back link -->
		<a
			href="/"
			class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
			</svg>
			Back to dashboard
		</a>

		<!-- Header -->
		<div class="space-y-2">
			<div
				class="w-14 h-14 mx-auto bg-green-100 rounded-2xl flex items-center justify-center"
				aria-hidden="true"
			>
				<svg class="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
					<path d="M12 18h.01" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-gray-900">Connect a Device</h1>
			<p class="text-gray-500 text-sm leading-relaxed">
				Scan this QR code with your phone's camera to open ProSys, then add it to your home screen.
			</p>
		</div>

		<!-- QR Code -->
		{#if loading}
			<div class="flex items-center justify-center h-[280px]">
				<div class="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
				{error}
			</div>
		{:else}
			<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 inline-block">
				<img
					src={qrDataUrl}
					alt="QR code linking to {connectUrl}"
					class="w-[280px] h-[280px] mx-auto"
				/>
			</div>

			<!-- URL fallback -->
			<div class="space-y-1.5">
				<p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Or type this URL</p>
				<div class="bg-gray-100 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 select-all">
					{connectUrl}
				</div>
			</div>
		{/if}

		<!-- Instructions -->
		<div class="bg-gray-50 rounded-xl p-4 text-left space-y-3">
			<h2 class="text-sm font-semibold text-gray-700">How to install on your phone</h2>
			<ol class="text-sm text-gray-500 space-y-2 list-decimal list-inside">
				<li>Scan the QR code with your phone's camera</li>
				<li>The app will open in Safari</li>
				<li>
					Tap the <span class="inline-flex items-baseline">
						<svg class="w-3.5 h-3.5 text-gray-500 self-center mx-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
							<polyline points="16 6 12 2 8 6" />
							<line x1="12" y1="2" x2="12" y2="15" />
						</svg>
					</span> Share button, then <strong>"Add to Home Screen"</strong>
				</li>
			</ol>
		</div>
	</div>
</div>
