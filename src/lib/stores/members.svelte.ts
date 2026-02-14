import type { Member, ThemeConfig } from '$lib/types';

type CreateMemberData = {
	name: string;
	theme: ThemeConfig;
	quote: { text: string; author: string };
};

type UpdateMemberData = {
	name?: string;
	theme?: ThemeConfig;
	quote?: { text: string; author: string };
};

function createMemberStore() {
	let members = $state<Member[]>([]);
	let selectedMemberId = $state('');
	let loading = $state(false);

	const selectedMember = $derived(
		members.find((m) => m.id === selectedMemberId)
	);

	return {
		get members() {
			return members;
		},
		get selectedMemberId() {
			return selectedMemberId;
		},
		get selectedMember() {
			return selectedMember;
		},
		get loading() {
			return loading;
		},

		select(id: string) {
			selectedMemberId = id;
		},

		async load(): Promise<void> {
			loading = true;
			try {
				const res = await fetch('/api/members');
				if (!res.ok) throw new Error(`Failed to load members: ${res.status}`);
				const data: Member[] = await res.json();
				members = data;

				// Auto-select first member if none selected or selection is invalid
				if (!selectedMemberId || !members.find((m) => m.id === selectedMemberId)) {
					selectedMemberId = members[0]?.id ?? '';
				}
			} finally {
				loading = false;
			}
		},

		async create(data: CreateMemberData): Promise<Member> {
			const res = await fetch('/api/members', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!res.ok) throw new Error(`Failed to create member: ${res.status}`);
			const created: Member = await res.json();
			members = [...members, created];
			selectedMemberId = created.id;
			return created;
		},

		async update(id: string, data: UpdateMemberData): Promise<void> {
			// Optimistic update
			const idx = members.findIndex((m) => m.id === id);
			if (idx === -1) return;
			const previous = members[idx];
			const optimistic = { ...previous };
			if (data.name !== undefined) optimistic.name = data.name;
			if (data.theme !== undefined) optimistic.theme = data.theme;
			if (data.quote !== undefined) optimistic.quote = data.quote;
			members = members.map((m) => (m.id === id ? optimistic : m));

			try {
				const res = await fetch(`/api/members/${id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data)
				});
				if (!res.ok) throw new Error(`Failed to update member: ${res.status}`);
				const updated: Member = await res.json();
				members = members.map((m) => (m.id === id ? updated : m));
			} catch (err) {
				// Rollback on failure
				members = members.map((m) => (m.id === id ? previous : m));
				throw err;
			}
		},

		async delete(id: string): Promise<void> {
			// Optimistic removal
			const previous = [...members];
			members = members.filter((m) => m.id !== id);

			// Re-select if the deleted member was selected
			if (selectedMemberId === id) {
				selectedMemberId = members[0]?.id ?? '';
			}

			try {
				const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
				if (!res.ok) {
					throw new Error(`Failed to delete member: ${res.status}`);
				}
			} catch (err) {
				// Rollback on failure
				members = previous;
				throw err;
			}
		}
	};
}

export const memberStore = createMemberStore();
