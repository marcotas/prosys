<script lang="ts">
	import { ArrowClockwise, X } from 'phosphor-svelte';

	interface Props {
		message: string;
		detail?: string;
		actionLabel: string;
		onAction: () => void;
		onDismiss: () => void;
	}

	const { message, detail, actionLabel, onAction, onDismiss }: Props = $props();
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
		<div class="shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600" aria-hidden="true">
			<ArrowClockwise size="20" weight="bold" color="currentColor" />
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
			<X size="16" weight="bold" color="currentColor" />
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
