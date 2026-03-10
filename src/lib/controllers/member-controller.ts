import type { MemberData, ThemeConfig } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import { ChangeNotifier } from '$lib/domain/change-notifier';
import { Member } from '$lib/domain/member';
import { MemberCollection } from '$lib/domain/member-collection';
import { optimisticAction, isNetworkError } from '$lib/infra/optimistic-action';

export class MemberController extends ChangeNotifier {
	private members = new MemberCollection();
	private _loading = false;
	private _selectedMemberId = '';

	constructor(
		private api: ApiClient,
		private offlineQueue: OfflineQueue,
		ws: WebSocketClient
	) {
		super();
		ws.onMessage('member:created', (p: MemberData) => this.applyRemoteCreate(p));
		ws.onMessage('member:updated', (p: MemberData) => this.applyRemoteUpdate(p));
		ws.onMessage('member:deleted', (p: { id: string }) => this.applyRemoteDelete(p));
	}

	// ── Getters ──────────────────────────────────────────────

	get loading(): boolean {
		return this._loading;
	}

	get selectedMemberId(): string {
		return this._selectedMemberId;
	}

	get selectedMember(): MemberData | undefined {
		return this.members.getById(this._selectedMemberId)?.toJSON();
	}

	get allMembers(): MemberData[] {
		return this.members.getAll().map((m) => m.toJSON());
	}

	// ── Selection ────────────────────────────────────────────

	select(id: string): void {
		this._selectedMemberId = id;
		this.notifyChanges();
	}

	// ── Hydration (from SSR) ─────────────────────────────────

	hydrate(memberList: MemberData[], selectedId: string): void {
		this.members.hydrate(memberList.map((m) => Member.fromData(m)));
		if (!this._selectedMemberId || !this.members.getById(this._selectedMemberId)) {
			this._selectedMemberId = selectedId;
		}
		this.notifyChanges();
	}

	// ── Loader ───────────────────────────────────────────────

	async load(): Promise<void> {
		this._loading = true;
		this.notifyChanges();
		try {
			const data = await this.api.get<MemberData[]>('/api/members');
			this.members.hydrate(data.map((m) => Member.fromData(m)));

			// Auto-select first member if none selected or selection is invalid
			if (!this._selectedMemberId || !this.members.getById(this._selectedMemberId)) {
				this._selectedMemberId = this.members.getAll()[0]?.id ?? '';
			}
		} finally {
			this._loading = false;
			this.notifyChanges();
		}
	}

	// ── Mutations ────────────────────────────────────────────

	async create(data: {
		name: string;
		theme: ThemeConfig;
		quote: { text: string; author: string };
	}): Promise<MemberData | null> {
		try {
			const created = await this.api.post<MemberData>('/api/members', data);
			const member = Member.fromData(created);
			this.members.insert(member);
			this._selectedMemberId = member.id;
			this.notifyChanges();
			return created;
		} catch (err) {
			if (isNetworkError(err)) {
				const now = new Date().toISOString();
				const tempData: MemberData = {
					id: `temp-${Date.now()}`,
					name: data.name,
					theme: { ...data.theme },
					quote: { ...data.quote },
					createdAt: now,
					updatedAt: now
				};
				const member = Member.fromData(tempData);
				this.members.insert(member);
				this._selectedMemberId = member.id;
				this.notifyChanges();
				await this.offlineQueue.enqueue({
					method: 'POST',
					url: '/api/members',
					body: data,
					headers: this.api.getHeaders()
				});
				return tempData;
			}
			throw err;
		}
	}

	async update(
		id: string,
		data: { name?: string; theme?: ThemeConfig; quote?: { text: string; author: string } }
	): Promise<void> {
		const existing = this.members.getById(id);
		if (!existing) return;

		await optimisticAction<MemberData>(
			this.members,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					this.members.update(id, (member) => {
						if (data.name !== undefined) member.updateName(data.name);
						if (data.theme !== undefined) member.updateTheme(data.theme);
						if (data.quote !== undefined) member.updateQuote(data.quote);
					});
				},
				request: () => this.api.patch<MemberData>(`/api/members/${id}`, data),
				onSuccess: (serverData) => {
					this.members.insert(Member.fromData(serverData));
				},
				offlinePayload: {
					method: 'PATCH',
					url: `/api/members/${id}`,
					body: data,
					headers: this.api.getHeaders()
				},
				onNotFound: () => {
					this.members.remove(id);
				}
			}
		);
	}

	async delete(id: string): Promise<void> {
		await optimisticAction<void>(
			this.members,
			this.offlineQueue,
			() => this.notifyChanges(),
			{
				apply: () => {
					this.members.remove(id);
					if (this._selectedMemberId === id) {
						this._selectedMemberId = this.members.getAll()[0]?.id ?? '';
					}
				},
				request: () => this.api.delete<void>(`/api/members/${id}`),
				onSuccess: () => {},
				offlinePayload: {
					method: 'DELETE',
					url: `/api/members/${id}`,
					headers: this.api.getHeaders()
				},
				onNotFound: () => {}
			}
		);
	}

	// ── Remote sync ──────────────────────────────────────────

	applyRemoteCreate(member: MemberData): void {
		// Only add if not already present (prevent dupes)
		if (this.members.getById(member.id)) return;
		this.members.insert(Member.fromData(member));
		this.notifyChanges();
	}

	applyRemoteUpdate(member: MemberData): void {
		this.members.insert(Member.fromData(member));
		this.notifyChanges();
	}

	applyRemoteDelete(payload: { id: string }): void {
		this.members.remove(payload.id);
		if (this._selectedMemberId === payload.id) {
			this._selectedMemberId = this.members.getAll()[0]?.id ?? '';
		}
		this.notifyChanges();
	}
}
