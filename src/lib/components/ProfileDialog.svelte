<script lang="ts">
	import { X } from 'phosphor-svelte';
	import ThemePicker from './ThemePicker.svelte';
	import type { Member, ThemeConfig } from '$lib/types';
	import { themePresets } from '$lib/types';

	const {
		open = false,
		member = null as Member | null,
		onSave,
		onDelete,
		onClose
	} = $props<{
		open: boolean;
		member: Member | null;
		onSave: (data: { name: string; theme: ThemeConfig; quote: { text: string; author: string } }) => void;
		onDelete?: (id: string) => void;
		onClose: () => void;
	}>();

	const isEditing = $derived(member !== null);
	const title = $derived(isEditing ? 'Edit Profile' : 'New Profile');

	let name = $state('');
	let quoteText = $state('');
	let quoteAuthor = $state('');
	let theme = $state<ThemeConfig>(themePresets[0].config);
	let showDeleteConfirm = $state(false);

	// Reset form when dialog opens or member changes
	$effect(() => {
		if (open) {
			if (member) {
				name = member.name;
				quoteText = member.quote.text;
				quoteAuthor = member.quote.author;
				theme = { ...member.theme };
			} else {
				name = '';
				quoteText = '';
				quoteAuthor = '';
				theme = { ...themePresets[0].config };
			}
			showDeleteConfirm = false;
		}
	});

	function handleSave() {
		if (!name.trim()) return;
		onSave({
			name: name.trim(),
			theme,
			quote: {
				text: quoteText.trim() || 'Every day is a new adventure',
				author: quoteAuthor.trim() || name.trim()
			}
		});
		onClose();
	}

	function handleDelete() {
		if (member && onDelete) {
			onDelete(member.id);
			onClose();
		}
	}

	const canSave = $derived(name.trim().length > 0);
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-start justify-center pt-8 px-4 overflow-y-auto"
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	>
		<!-- Dialog -->
		<div
			class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8 overflow-hidden"
			role="dialog"
			aria-label={title}
		>
			<!-- Header -->
			<div
				class="px-6 py-4 flex items-center justify-between"
				style="background-color: {theme.accent}; color: white"
			>
				<div class="flex items-center gap-3">
					{#if theme.variant === 'playful' && theme.emoji}
						<span class="text-2xl">{theme.emoji}</span>
					{:else}
						<div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
							{name ? name.charAt(0).toUpperCase() : '?'}
						</div>
					{/if}
					<div>
						<h2 class="text-lg font-bold">{title}</h2>
						<p class="text-sm opacity-80">{name || 'Enter a name...'}</p>
					</div>
				</div>
				<button
					onclick={onClose}
					class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
					aria-label="Close dialog"
				>
					<X size="16" weight="bold" color="currentColor" />
				</button>
			</div>

			<!-- Body -->
			<div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
				<!-- Name -->
				<div>
					<label for="profile-name" class="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
					<input
						id="profile-name"
						type="text"
						bind:value={name}
						placeholder="Enter name..."
						class="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 text-base focus:outline-none transition-colors"
						style="focus:border-color: {theme.accent}"
						onfocus={(e) => { (e.target as HTMLInputElement).style.borderColor = theme.accent; }}
						onblur={(e) => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
					/>
				</div>

				<!-- Theme Picker -->
				<ThemePicker value={theme} onChange={(t) => (theme = t)} />

				<!-- Quote -->
				<div class="space-y-3">
					<label class="block text-sm font-medium text-gray-700">
						{theme.variant === 'playful' ? 'Motivational quote' : 'Weekly quote'}
					</label>
					<input
						type="text"
						bind:value={quoteText}
						placeholder={theme.variant === 'playful' ? 'e.g. "To infinity and beyond!"' : 'e.g. "Tiny Changes, Remarkable Results"'}
						class="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 text-base focus:outline-none transition-colors"
						onfocus={(e) => { (e.target as HTMLInputElement).style.borderColor = theme.accent; }}
						onblur={(e) => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
					/>
					<input
						type="text"
						bind:value={quoteAuthor}
						placeholder={theme.variant === 'playful' ? 'e.g. Buzz Lightyear' : 'e.g. James Clear'}
						class="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 text-base focus:outline-none transition-colors"
						onfocus={(e) => { (e.target as HTMLInputElement).style.borderColor = theme.accent; }}
						onblur={(e) => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
					/>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
				{#if isEditing && onDelete}
					{#if showDeleteConfirm}
						<div class="flex items-center gap-2">
							<span class="text-sm text-red-600">Delete this profile?</span>
							<button
								onclick={handleDelete}
								class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
							>
								Yes, delete
							</button>
							<button
								onclick={() => (showDeleteConfirm = false)}
								class="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
							>
								Cancel
							</button>
						</div>
					{:else}
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
						>
							Delete profile
						</button>
					{/if}
				{/if}
				<div class="flex-1"></div>
				<button
					onclick={onClose}
					class="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={!canSave}
					class="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all
						{canSave ? 'hover:opacity-90 shadow-sm' : 'opacity-50 cursor-not-allowed'}"
					style="background-color: {theme.accent}"
				>
					{isEditing ? 'Save Changes' : 'Create Profile'}
				</button>
			</div>
		</div>
	</div>
{/if}
