<script lang="ts">
	import type { ThemeConfig, ThemeVariant } from '$lib/types';
	import { themePresets, emojiOptions } from '$lib/types';

	let { value, onChange } = $props<{
		value: ThemeConfig;
		onChange: (theme: ThemeConfig) => void;
	}>();

	let selectedPresetId = $state(
		themePresets.find((p) => p.config.accent === value.accent)?.id ?? 'green'
	);
	let variant = $state<ThemeVariant>(value.variant);
	let emoji = $state(value.emoji || '🦄');
	let showEmojiGrid = $state(false);

	function selectPreset(presetId: string) {
		selectedPresetId = presetId;
		applyTheme();
	}

	function toggleVariant(v: ThemeVariant) {
		variant = v;
		applyTheme();
	}

	function selectEmoji(e: string) {
		emoji = e;
		showEmojiGrid = false;
		applyTheme();
	}

	function applyTheme() {
		const preset = themePresets.find((p) => p.id === selectedPresetId);
		if (!preset) return;
		const theme: ThemeConfig = {
			...preset.config,
			variant,
			emoji: variant === 'playful' ? emoji : ''
		};
		onChange(theme);
	}

	let currentPreset = $derived(themePresets.find((p) => p.id === selectedPresetId));
</script>

<div class="space-y-5">
	<!-- Profile Type -->
	<div>
		<label class="block text-sm font-medium text-gray-700 mb-2">Profile type</label>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => toggleVariant('default')}
				class="flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
					{variant === 'default' ? 'shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}"
				style={variant === 'default' ? `border-color: ${currentPreset?.color}; background-color: ${currentPreset?.config.accentLight}40; color: ${currentPreset?.config.accentDark}` : ''}
			>
				<div class="font-semibold mb-0.5">Adult</div>
				<div class="text-xs opacity-70">Clean and professional</div>
			</button>
			<button
				type="button"
				onclick={() => toggleVariant('playful')}
				class="flex-1 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
					{variant === 'playful' ? 'shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}"
				style={variant === 'playful' ? `border-color: ${currentPreset?.color}; background-color: ${currentPreset?.config.accentLight}40; color: ${currentPreset?.config.accentDark}` : ''}
			>
				<div class="font-semibold mb-0.5">Kid</div>
				<div class="text-xs opacity-70">Fun, colorful & emoji</div>
			</button>
		</div>
	</div>

	<!-- Color Palette -->
	<div>
		<label class="block text-sm font-medium text-gray-700 mb-2">Color theme</label>
		<div class="grid grid-cols-4 gap-2">
			{#each themePresets as preset (preset.id)}
				{@const isSelected = selectedPresetId === preset.id}
				<button
					type="button"
					onclick={() => selectPreset(preset.id)}
					class="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-105
						{isSelected ? 'shadow-md' : 'border-gray-100 hover:border-gray-200'}"
					style={isSelected ? `border-color: ${preset.color}; background-color: ${preset.config.accentLight}` : ''}
				>
					<div
						class="w-8 h-8 rounded-full shadow-inner transition-transform
							{isSelected ? 'scale-110 ring-2 ring-white ring-offset-2' : ''}"
						style="background-color: {preset.color}; {isSelected ? `ring-offset-color: ${preset.config.accentLight}` : ''}"
					></div>
					<span class="text-xs font-medium {isSelected ? '' : 'text-gray-500'}"
						style={isSelected ? `color: ${preset.config.accentDark}` : ''}
					>
						{preset.label}
					</span>
					{#if isSelected}
						<div class="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
							style="background-color: {preset.color}"
						>
							<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none">
								<path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Emoji Picker (only for playful variant) -->
	{#if variant === 'playful'}
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">Avatar emoji</label>
			<div class="relative">
				<button
					type="button"
					onclick={() => (showEmojiGrid = !showEmojiGrid)}
					class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 w-full text-left transition-all hover:border-gray-300"
					style={showEmojiGrid ? `border-color: ${currentPreset?.color}` : 'border-color: #e5e7eb'}
				>
					<span class="text-2xl">{emoji}</span>
					<span class="text-sm text-gray-600">Tap to change avatar emoji</span>
					<svg class="w-4 h-4 text-gray-400 ml-auto transition-transform {showEmojiGrid ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>

				{#if showEmojiGrid}
					<div class="absolute z-10 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg p-3">
						<div class="grid grid-cols-8 gap-1">
							{#each emojiOptions as opt}
								<button
									type="button"
									onclick={() => selectEmoji(opt)}
									class="w-9 h-9 flex items-center justify-center text-xl rounded-lg transition-all hover:scale-125
										{emoji === opt ? 'ring-2' : 'hover:bg-gray-100'}"
									style={emoji === opt ? `background-color: ${currentPreset?.config.accentLight}; ring-color: ${currentPreset?.color}` : ''}
								>
									{opt}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Live Preview -->
	<div>
		<label class="block text-sm font-medium text-gray-700 mb-2">Preview</label>
		<div
			class="rounded-xl overflow-hidden border-2 transition-all"
			style="border-color: {currentPreset?.color}30"
		>
			<div class="text-white px-4 py-2 flex items-center gap-2"
				style="background-color: {currentPreset?.color}"
			>
				{#if variant === 'playful'}
					<span class="text-lg">{emoji}</span>
				{/if}
				<span class="font-semibold text-sm">
					{variant === 'playful' ? 'Monday ✨' : 'Monday'}
				</span>
			</div>
			<div class="px-4 py-3 space-y-2"
				style={variant === 'playful' ? `background-color: ${currentPreset?.config.accentLight}40` : ''}
			>
				<div class="flex items-center gap-2">
					<div
						class="w-4 h-4 rounded flex items-center justify-center text-white text-xs"
						style="background-color: {currentPreset?.color}"
					>
						{#if variant === 'playful'}⭐{:else}
							<svg class="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
								<path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{/if}
					</div>
					<span class="text-sm line-through opacity-50">
						{variant === 'playful' ? '📚 Read a chapter' : 'Complete project report'}
					</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded border-2"
						style="border-color: {currentPreset?.color}40"
					></div>
					<span class="text-sm text-gray-700">
						{variant === 'playful' ? '🎨 Art project' : 'Review quarterly goals'}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
