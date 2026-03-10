import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberController } from './member-controller';
import type { MemberData, ThemeConfig } from '$lib/domain/types';
import type { ApiClient } from '$lib/infra/api-client';
import type { OfflineQueue } from '$lib/infra/offline-queue';
import type { WebSocketClient } from '$lib/infra/ws-client';
import { ApiError } from '$lib/utils/api-error';

// ── Mock factories ──────────────────────────────────────

function createMockApi(): ApiClient {
	return {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		setClientId: vi.fn(),
		getHeaders: vi.fn().mockReturnValue({ 'X-WS-Client-Id': 'test-id' })
	} as unknown as ApiClient;
}

function createMockQueue(): OfflineQueue {
	return {
		enqueue: vi.fn(),
		getAll: vi.fn().mockResolvedValue([]),
		remove: vi.fn(),
		clear: vi.fn(),
		pendingCount: 0,
		init: vi.fn(),
		replay: vi.fn(),
		onChange: vi.fn(),
		dispose: vi.fn()
	} as unknown as OfflineQueue;
}

interface MockWebSocketClient extends WebSocketClient {
	__dispatch: (type: string, payload: unknown) => void;
}

function createMockWs(): MockWebSocketClient {
	const handlers = new Map<string, Set<(payload: unknown) => void>>();
	return {
		clientId: 'test-client',
		connected: true,
		syncing: false,
		onMessage: vi.fn((type: string, handler: (payload: unknown) => void) => {
			let set = handlers.get(type);
			if (!set) {
				set = new Set();
				handlers.set(type, set);
			}
			set.add(handler);
			return () => set!.delete(handler);
		}),
		onSync: vi.fn(),
		connect: vi.fn(),
		destroy: vi.fn(),
		onChange: vi.fn(),
		dispose: vi.fn(),
		// Test helper to dispatch messages
		__dispatch(type: string, payload: unknown) {
			const set = handlers.get(type);
			if (set) for (const h of set) h(payload);
		}
	} as unknown as MockWebSocketClient;
}

const defaultTheme: ThemeConfig = {
	variant: 'default',
	accent: '#4a7c59',
	accentLight: '#dcfce7',
	accentDark: '#1e3a24',
	headerBg: '#4a7c59',
	ringColor: '#4a7c59',
	checkColor: '#4a7c59',
	emoji: ''
};

function makeMember(overrides: Partial<MemberData> = {}): MemberData {
	return {
		id: 'm1',
		name: 'Alice',
		theme: { ...defaultTheme },
		quote: { text: 'Hello', author: 'Alice' },
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

// ── Tests ───────────────────────────────────────────────

describe('MemberController', () => {
	let api: ReturnType<typeof createMockApi>;
	let queue: ReturnType<typeof createMockQueue>;
	let ws: ReturnType<typeof createMockWs>;
	let ctrl: MemberController;

	beforeEach(() => {
		api = createMockApi();
		queue = createMockQueue();
		ws = createMockWs();
		ctrl = new MemberController(api, queue, ws);
	});

	// ── Constructor ─────────────────────────────────────

	describe('constructor', () => {
		it('registers 3 WebSocket handlers', () => {
			expect(ws.onMessage).toHaveBeenCalledTimes(3);
			expect(ws.onMessage).toHaveBeenCalledWith('member:created', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('member:updated', expect.any(Function));
			expect(ws.onMessage).toHaveBeenCalledWith('member:deleted', expect.any(Function));
		});

		it('starts with loading false', () => {
			expect(ctrl.loading).toBe(false);
		});

		it('starts with empty selectedMemberId', () => {
			expect(ctrl.selectedMemberId).toBe('');
		});

		it('starts with empty allMembers', () => {
			expect(ctrl.allMembers).toEqual([]);
		});

		it('starts with undefined selectedMember', () => {
			expect(ctrl.selectedMember).toBeUndefined();
		});
	});

	// ── Getters ─────────────────────────────────────────

	describe('getters', () => {
		it('allMembers returns plain objects (MemberData[])', () => {
			ctrl.hydrate([makeMember()], 'm1');
			const members = ctrl.allMembers;
			expect(members).toHaveLength(1);
			expect(members[0]).toEqual(makeMember());
			// Verify it's a plain object, not an entity instance
			expect(members[0].constructor).toBe(Object);
		});

		it('selectedMember returns plain object for selected member', () => {
			ctrl.hydrate([makeMember()], 'm1');
			const selected = ctrl.selectedMember;
			expect(selected).toBeDefined();
			expect(selected!.id).toBe('m1');
			expect(selected!.constructor).toBe(Object);
		});

		it('selectedMember returns undefined when no member is selected', () => {
			ctrl.hydrate([makeMember()], '');
			expect(ctrl.selectedMember).toBeUndefined();
		});
	});

	// ── Selection ───────────────────────────────────────

	describe('select', () => {
		it('updates selectedMemberId and notifies', () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			const listener = vi.fn();
			ctrl.onChange(listener);

			ctrl.select('m2');

			expect(ctrl.selectedMemberId).toBe('m2');
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	// ── Hydration ───────────────────────────────────────

	describe('hydrate', () => {
		it('populates members and sets selectedMemberId', () => {
			ctrl.hydrate([makeMember()], 'm1');
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.selectedMemberId).toBe('m1');
		});

		it('preserves existing valid selectedMemberId', () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			ctrl.select('m2');

			// Re-hydrate should NOT overwrite because m2 is still valid
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			expect(ctrl.selectedMemberId).toBe('m2');
		});

		it('overwrites selectedMemberId when current selection is invalid', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			ctrl.select('nonexistent');

			// Re-hydrate should overwrite because 'nonexistent' is invalid
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm2');
			expect(ctrl.selectedMemberId).toBe('m2');
		});

		it('sets selectedMemberId when none was set', () => {
			ctrl.hydrate([makeMember()], 'm1');
			expect(ctrl.selectedMemberId).toBe('m1');
		});

		it('notifies changes', () => {
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.hydrate([makeMember()], 'm1');
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	// ── Loader ──────────────────────────────────────────

	describe('load', () => {
		it('fetches members from API and hydrates', async () => {
			const members = [makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })];
			vi.mocked(api.get).mockResolvedValue(members);

			await ctrl.load();

			expect(api.get).toHaveBeenCalledWith('/api/members');
			expect(ctrl.allMembers).toHaveLength(2);
			expect(ctrl.selectedMemberId).toBe('m1');
		});

		it('sets loading to true during fetch, then false', async () => {
			const states: boolean[] = [];
			ctrl.onChange(() => states.push(ctrl.loading));
			vi.mocked(api.get).mockResolvedValue([makeMember()]);

			await ctrl.load();

			expect(states[0]).toBe(true); // loading started
			expect(states[states.length - 1]).toBe(false); // loading ended
		});

		it('auto-selects first member if selection is invalid', async () => {
			vi.mocked(api.get).mockResolvedValue([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })]);

			await ctrl.load();

			expect(ctrl.selectedMemberId).toBe('m1');
		});

		it('preserves valid selection after load', async () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			ctrl.select('m2');

			vi.mocked(api.get).mockResolvedValue([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })]);

			await ctrl.load();

			expect(ctrl.selectedMemberId).toBe('m2');
		});

		it('sets selectedMemberId to empty string when API returns empty list', async () => {
			vi.mocked(api.get).mockResolvedValue([]);

			await ctrl.load();

			expect(ctrl.selectedMemberId).toBe('');
			expect(ctrl.allMembers).toHaveLength(0);
		});

		it('sets loading false even on error', async () => {
			vi.mocked(api.get).mockRejectedValue(new Error('fail'));

			await expect(ctrl.load()).rejects.toThrow('fail');
			expect(ctrl.loading).toBe(false);
		});
	});

	// ── Mutations: create ───────────────────────────────

	describe('create', () => {
		const createData = {
			name: 'Charlie',
			theme: defaultTheme,
			quote: { text: 'Hi', author: 'Charlie' }
		};

		it('waits for server response before inserting into collection', async () => {
			const serverMember = makeMember({ id: 'server-id', name: 'Charlie' });
			vi.mocked(api.post).mockResolvedValue(serverMember);

			const result = await ctrl.create(createData);

			expect(api.post).toHaveBeenCalledWith('/api/members', createData);
			expect(result).toEqual(serverMember);
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('server-id');
			expect(ctrl.selectedMemberId).toBe('server-id');
		});

		it('on network error: inserts temp member and enqueues offline', async () => {
			vi.mocked(api.post).mockRejectedValue(new TypeError('fetch failed'));

			const result = await ctrl.create(createData);

			expect(result).not.toBeNull();
			expect(result!.id).toMatch(/^temp-/);
			expect(result!.name).toBe('Charlie');
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.selectedMemberId).toBe(result!.id);
			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'POST',
				url: '/api/members',
				body: createData,
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
		});

		it('on server error: does not insert and rethrows', async () => {
			const serverErr = new ApiError('Validation failed', 422);
			vi.mocked(api.post).mockRejectedValue(serverErr);

			await expect(ctrl.create(createData)).rejects.toThrow('Validation failed');
			expect(ctrl.allMembers).toHaveLength(0);
		});

		it('notifies changes after successful create', async () => {
			const serverMember = makeMember({ id: 'server-id', name: 'Charlie' });
			vi.mocked(api.post).mockResolvedValue(serverMember);
			const listener = vi.fn();
			ctrl.onChange(listener);

			await ctrl.create(createData);

			expect(listener).toHaveBeenCalled();
		});

		it('returns created member data', async () => {
			const serverMember = makeMember({ id: 'server-id', name: 'Charlie' });
			vi.mocked(api.post).mockResolvedValue(serverMember);

			const result = await ctrl.create(createData);

			expect(result).toEqual(serverMember);
		});
	});

	// ── Mutations: update ───────────────────────────────

	describe('update', () => {
		beforeEach(() => {
			ctrl.hydrate([makeMember({ id: 'm1', name: 'Alice' })], 'm1');
		});

		it('optimistically updates member name', async () => {
			const updated = makeMember({ id: 'm1', name: 'Alicia' });
			vi.mocked(api.patch).mockResolvedValue(updated);

			const promise = ctrl.update('m1', { name: 'Alicia' });

			// Optimistic: name should be updated immediately
			expect(ctrl.allMembers[0].name).toBe('Alicia');

			await promise;

			// After server response
			expect(ctrl.allMembers[0].name).toBe('Alicia');
			expect(api.patch).toHaveBeenCalledWith('/api/members/m1', { name: 'Alicia' });
		});

		it('optimistically updates member theme', async () => {
			const newTheme: ThemeConfig = { ...defaultTheme, accent: '#ff0000' };
			const updated = makeMember({ id: 'm1', theme: newTheme });
			vi.mocked(api.patch).mockResolvedValue(updated);

			await ctrl.update('m1', { theme: newTheme });

			expect(ctrl.allMembers[0].theme.accent).toBe('#ff0000');
		});

		it('optimistically updates member quote', async () => {
			const newQuote = { text: 'New quote', author: 'Author' };
			const updated = makeMember({ id: 'm1', quote: newQuote });
			vi.mocked(api.patch).mockResolvedValue(updated);

			await ctrl.update('m1', { quote: newQuote });

			expect(ctrl.allMembers[0].quote).toEqual(newQuote);
		});

		it('replaces with server response on success', async () => {
			const serverData = makeMember({ id: 'm1', name: 'ServerName', updatedAt: '2026-02-01T00:00:00.000Z' });
			vi.mocked(api.patch).mockResolvedValue(serverData);

			await ctrl.update('m1', { name: 'ClientName' });

			expect(ctrl.allMembers[0].name).toBe('ServerName');
			expect(ctrl.allMembers[0].updatedAt).toBe('2026-02-01T00:00:00.000Z');
		});

		it('rolls back on server error', async () => {
			vi.mocked(api.patch).mockRejectedValue(new ApiError('Server error', 500));

			await expect(ctrl.update('m1', { name: 'NewName' })).rejects.toThrow('Server error');
			expect(ctrl.allMembers[0].name).toBe('Alice');
		});

		it('enqueues offline on network error', async () => {
			vi.mocked(api.patch).mockRejectedValue(new TypeError('fetch failed'));

			await ctrl.update('m1', { name: 'Offline' });

			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'PATCH',
				url: '/api/members/m1',
				body: { name: 'Offline' },
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
			// Optimistic update stays
			expect(ctrl.allMembers[0].name).toBe('Offline');
		});

		it('removes member on 404 (onNotFound)', async () => {
			vi.mocked(api.patch).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.update('m1', { name: 'Ghost' });

			expect(ctrl.allMembers).toHaveLength(0);
		});

		it('no-ops for nonexistent member', async () => {
			await ctrl.update('nonexistent', { name: 'Nope' });
			expect(api.patch).not.toHaveBeenCalled();
		});
	});

	// ── Mutations: delete ───────────────────────────────

	describe('delete', () => {
		beforeEach(() => {
			ctrl.hydrate(
				[makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })],
				'm1'
			);
		});

		it('optimistically removes member from collection', async () => {
			vi.mocked(api.delete).mockResolvedValue(undefined);

			const promise = ctrl.delete('m2');

			// Optimistic removal
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('m1');

			await promise;
			expect(api.delete).toHaveBeenCalledWith('/api/members/m2');
		});

		it('auto-selects first remaining member when deleting selected', async () => {
			vi.mocked(api.delete).mockResolvedValue(undefined);

			ctrl.select('m1');
			await ctrl.delete('m1');

			expect(ctrl.selectedMemberId).toBe('m2');
		});

		it('sets selectedMemberId to empty string when last member is deleted', async () => {
			// Create a fresh controller with only one member
			const freshCtrl = new MemberController(api, queue, ws);
			freshCtrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			vi.mocked(api.delete).mockResolvedValue(undefined);

			await freshCtrl.delete('m1');

			expect(freshCtrl.selectedMemberId).toBe('');
		});

		it('does not change selection when deleting non-selected member', async () => {
			vi.mocked(api.delete).mockResolvedValue(undefined);

			ctrl.select('m1');
			await ctrl.delete('m2');

			expect(ctrl.selectedMemberId).toBe('m1');
		});

		it('rolls back on server error', async () => {
			vi.mocked(api.delete).mockRejectedValue(new ApiError('Server error', 500));

			await expect(ctrl.delete('m1')).rejects.toThrow('Server error');
			expect(ctrl.allMembers).toHaveLength(2);
		});

		it('enqueues offline on network error', async () => {
			vi.mocked(api.delete).mockRejectedValue(new TypeError('fetch failed'));

			await ctrl.delete('m2');

			expect(queue.enqueue).toHaveBeenCalledWith({
				method: 'DELETE',
				url: '/api/members/m2',
				headers: { 'X-WS-Client-Id': 'test-id' }
			});
			// Optimistic removal stays
			expect(ctrl.allMembers).toHaveLength(1);
		});

		it('no-ops on 404 (onNotFound)', async () => {
			vi.mocked(api.delete).mockRejectedValue(new ApiError('Not found', 404));

			await ctrl.delete('m2');

			// Member already removed optimistically, no rollback
			expect(ctrl.allMembers).toHaveLength(1);
		});
	});

	// ── Remote sync ─────────────────────────────────────

	describe('applyRemoteCreate', () => {
		it('adds member to collection', () => {
			ctrl.applyRemoteCreate(makeMember({ id: 'm1' }));
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('m1');
		});

		it('prevents duplicates', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			ctrl.applyRemoteCreate(makeMember({ id: 'm1' }));
			expect(ctrl.allMembers).toHaveLength(1);
		});

		it('notifies changes', () => {
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.applyRemoteCreate(makeMember());
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe('applyRemoteUpdate', () => {
		it('replaces member data in collection', () => {
			ctrl.hydrate([makeMember({ id: 'm1', name: 'Alice' })], 'm1');
			ctrl.applyRemoteUpdate(makeMember({ id: 'm1', name: 'Updated' }));
			expect(ctrl.allMembers[0].name).toBe('Updated');
		});

		it('notifies changes', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.applyRemoteUpdate(makeMember({ id: 'm1', name: 'New' }));
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe('applyRemoteDelete', () => {
		it('removes member from collection', () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			ctrl.applyRemoteDelete({ id: 'm2' });
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('m1');
		});

		it('auto-reselects when deleted member was selected', () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			ctrl.applyRemoteDelete({ id: 'm1' });
			expect(ctrl.selectedMemberId).toBe('m2');
		});

		it('sets selectedMemberId to empty when last member removed', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			ctrl.applyRemoteDelete({ id: 'm1' });
			expect(ctrl.selectedMemberId).toBe('');
		});

		it('notifies changes', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			const listener = vi.fn();
			ctrl.onChange(listener);
			ctrl.applyRemoteDelete({ id: 'm1' });
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	// ── WS handler dispatch ─────────────────────────────

	describe('WebSocket dispatch', () => {
		it('member:created dispatches to applyRemoteCreate', () => {
			const member = makeMember({ id: 'm-ws' });
			ws.__dispatch('member:created', member);
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('m-ws');
		});

		it('member:updated dispatches to applyRemoteUpdate', () => {
			ctrl.hydrate([makeMember({ id: 'm1', name: 'Old' })], 'm1');
			ws.__dispatch('member:updated', makeMember({ id: 'm1', name: 'WS Updated' }));
			expect(ctrl.allMembers[0].name).toBe('WS Updated');
		});

		it('member:deleted dispatches to applyRemoteDelete', () => {
			ctrl.hydrate([makeMember({ id: 'm1' }), makeMember({ id: 'm2', name: 'Bob' })], 'm1');
			ws.__dispatch('member:deleted', { id: 'm1' });
			expect(ctrl.allMembers).toHaveLength(1);
			expect(ctrl.allMembers[0].id).toBe('m2');
		});
	});

	// ── Edge cases ──────────────────────────────────────

	describe('edge cases', () => {
		it('create returns member data on success', async () => {
			const serverMember = makeMember({ id: 's1', name: 'Created' });
			vi.mocked(api.post).mockResolvedValue(serverMember);

			const result = await ctrl.create({ name: 'Created', theme: defaultTheme, quote: { text: '', author: '' } });

			expect(result).toEqual(serverMember);
		});

		it('hydrate merges new members (additive)', () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			ctrl.hydrate([makeMember({ id: 'm2', name: 'Bob' })], 'm2');
			expect(ctrl.allMembers).toHaveLength(2);
		});

		it('delete with non-existent id is a no-op on optimistic step', async () => {
			vi.mocked(api.delete).mockResolvedValue(undefined);
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');

			// The member won't be found by optimisticAction but the request still fires
			await ctrl.delete('nonexistent');

			expect(ctrl.allMembers).toHaveLength(1);
		});

		it('update with multiple fields applies all', async () => {
			ctrl.hydrate([makeMember({ id: 'm1' })], 'm1');
			const newTheme: ThemeConfig = { ...defaultTheme, accent: '#000' };
			const newQuote = { text: 'Q', author: 'A' };
			const serverData = makeMember({ id: 'm1', name: 'New', theme: newTheme, quote: newQuote });
			vi.mocked(api.patch).mockResolvedValue(serverData);

			await ctrl.update('m1', { name: 'New', theme: newTheme, quote: newQuote });

			const m = ctrl.allMembers[0];
			expect(m.name).toBe('New');
			expect(m.theme.accent).toBe('#000');
			expect(m.quote.text).toBe('Q');
		});
	});
});
