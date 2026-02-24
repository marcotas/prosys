<script lang="ts">
	interface Props {
		message: string;
		detail?: string;
		actionLabel: string;
		onAction: () => void;
		onDismiss: () => void;
	}

	let { message, detail, actionLabel, onAction, onDismiss }: Props = $props();
</script>

<div
	class="fixed bottom-0 inset-x-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
		animate-slide-up"
>
	<div
		class="mx-auto max-w-md bg-white rounded-2xl shadow-lg border border-gray-200
			px-4 py-3 flex items-start gap-3"
	>
		<!-- Icon -->
		<div class="shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center" aria-hidden="true">
			<svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 2v6h-6" />
				<path d="M3 12a9 9 0 0115.36-6.36L21 8" />
				<path d="M3 22v-6h6" />
				<path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
			</svg>
		</div>

		<!-- Text -->
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-gray-900">{message}</p>
			{#if detail}
				<p class="text-xs text-gray-500 mt-0.5">{detail}</p>
			{/if}
			<button
				onclick={onAction}
				class="mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
			>
				{actionLabel}
			</button>
		</div>

		<!-- Dismiss -->
		<button
			onclick={onDismiss}
			class="shrink-0 p-1 -mt-0.5 -mr-1 text-gray-400 hover:text-gray-600 transition-colors"
			aria-label="Dismiss"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6L6 18" /><path d="M6 6l12 12" />
			</svg>
		</button>
	</div>
</div>

<style>
	@keyframes slide-up {
		from { transform: translateY(100%); opacity: 0; }
		to   { transform: translateY(0);    opacity: 1; }
	}
	.animate-slide-up {
		animation: slide-up 0.35s ease-out;
	}
</style>
