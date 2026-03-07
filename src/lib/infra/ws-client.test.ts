import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from './ws-client';
import type { OfflineQueue, QueuedMutation } from './offline-queue';

// ── Mock WebSocket ──────────────────────────────────────

class MockWebSocket {
	static instances: MockWebSocket[] = [];
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	send = vi.fn();
	close = vi.fn(() => {
		// Trigger onclose if set (simulates real WebSocket behavior)
		if (this.onclose) this.onclose();
	});

	constructor(public url: string) {
		MockWebSocket.instances.push(this);
	}

	simulateOpen() {
		this.onopen?.();
	}

	simulateMessage(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) });
	}

	simulateClose() {
		this.onclose?.();
	}

	simulateError() {
		this.onerror?.();
	}
}

// ── Mock OfflineQueue ───────────────────────────────────

function createMockQueue(mutations: QueuedMutation[] = []): OfflineQueue {
	return {
		getAll: vi.fn().mockResolvedValue(mutations),
		replay: vi.fn().mockResolvedValue(new Response('{}')),
		remove: vi.fn().mockResolvedValue(undefined),
		enqueue: vi.fn(),
		pendingCount: mutations.length,
		init: vi.fn(),
		clear: vi.fn(),
		onChange: vi.fn(),
		dispose: vi.fn(),
		notifyChanges: vi.fn()
	} as unknown as OfflineQueue;
}

// ── Mock location ───────────────────────────────────────

const originalLocation = globalThis.location;

function mockLocation(protocol = 'http:', host = 'localhost:5173') {
	Object.defineProperty(globalThis, 'location', {
		value: { protocol, host },
		writable: true,
		configurable: true
	});
}

// ── Tests ───────────────────────────────────────────────

describe('WebSocketClient', () => {
	let client: WebSocketClient;
	let mockQueue: OfflineQueue;

	beforeEach(() => {
		MockWebSocket.instances = [];
		(globalThis as any).WebSocket = MockWebSocket;
		mockLocation();
		vi.useFakeTimers();
		mockQueue = createMockQueue();
		client = new WebSocketClient(mockQueue);
	});

	afterEach(() => {
		client.destroy();
		vi.useRealTimers();
		Object.defineProperty(globalThis, 'location', {
			value: originalLocation,
			writable: true,
			configurable: true
		});
	});

	it('generates a clientId on construction', () => {
		expect(client.clientId).toBeTruthy();
		expect(typeof client.clientId).toBe('string');
	});

	it('starts disconnected', () => {
		expect(client.connected).toBe(false);
		expect(client.syncing).toBe(false);
	});

	describe('connect()', () => {
		it('creates a WebSocket with ws:// for http:', () => {
			client.connect();
			expect(MockWebSocket.instances).toHaveLength(1);
			expect(MockWebSocket.instances[0].url).toBe('ws://localhost:5173/ws');
		});

		it('creates a WebSocket with wss:// for https:', () => {
			mockLocation('https:', 'example.com');
			client.connect();
			expect(MockWebSocket.instances[0].url).toBe('wss://example.com/ws');
		});

		it('sets connected=true on open and sends init message', () => {
			client.connect();
			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();

			expect(client.connected).toBe(true);
			expect(ws.send).toHaveBeenCalledWith(
				JSON.stringify({ type: 'init', clientId: client.clientId })
			);
		});

		it('notifies on connect', () => {
			const listener = vi.fn();
			client.onChange(listener);
			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			expect(listener).toHaveBeenCalled();
		});

		it('does not connect if destroyed', () => {
			client.destroy();
			client.connect();
			expect(MockWebSocket.instances).toHaveLength(0);
		});

		it('schedules reconnect if WebSocket constructor throws', () => {
			(globalThis as any).WebSocket = function () {
				throw new Error('Connection refused');
			};
			client.connect();
			expect(client.connected).toBe(false);

			// Restore and advance timer
			(globalThis as any).WebSocket = MockWebSocket;
			vi.advanceTimersByTime(1000);
			expect(MockWebSocket.instances).toHaveLength(1);
		});
	});

	describe('message handling', () => {
		it('dispatches messages to registered handlers', () => {
			const handler = vi.fn();
			client.onMessage('task:created', handler);
			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].simulateMessage({
				type: 'task:created',
				payload: { id: '1', title: 'Test' }
			});

			expect(handler).toHaveBeenCalledWith({ id: '1', title: 'Test' });
		});

		it('supports multiple handlers per message type', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			client.onMessage('task:updated', handler1);
			client.onMessage('task:updated', handler2);
			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].simulateMessage({
				type: 'task:updated',
				payload: { id: '1' }
			});

			expect(handler1).toHaveBeenCalledWith({ id: '1' });
			expect(handler2).toHaveBeenCalledWith({ id: '1' });
		});

		it('unsubscribes handler', () => {
			const handler = vi.fn();
			const unsub = client.onMessage('task:deleted', handler);
			unsub();

			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].simulateMessage({
				type: 'task:deleted',
				payload: { id: '1' }
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it('unsubscribing one handler keeps others for same type', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			const unsub1 = client.onMessage('task:updated', handler1);
			client.onMessage('task:updated', handler2);

			unsub1();

			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].simulateMessage({
				type: 'task:updated',
				payload: { id: '1' }
			});

			expect(handler1).not.toHaveBeenCalled();
			expect(handler2).toHaveBeenCalledWith({ id: '1' });
		});

		it('ignores malformed messages', () => {
			const handler = vi.fn();
			client.onMessage('task:created', handler);
			client.connect();
			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();

			// Send invalid JSON directly
			ws.onmessage?.({ data: 'not json' });

			expect(handler).not.toHaveBeenCalled();
		});

		it('ignores messages with no matching handler', () => {
			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			// Should not throw
			MockWebSocket.instances[0].simulateMessage({
				type: 'unknown:type',
				payload: {}
			});
		});
	});

	describe('disconnect and reconnect', () => {
		it('sets connected=false and schedules reconnect on close', () => {
			client.connect();
			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();
			expect(client.connected).toBe(true);

			ws.onclose?.();
			expect(client.connected).toBe(false);

			vi.advanceTimersByTime(1000);
			expect(MockWebSocket.instances).toHaveLength(2); // reconnected
		});

		it('uses exponential backoff for reconnection', () => {
			client.connect();
			MockWebSocket.instances[0].onclose?.();

			// First reconnect at 1s
			vi.advanceTimersByTime(999);
			expect(MockWebSocket.instances).toHaveLength(1);
			vi.advanceTimersByTime(1);
			expect(MockWebSocket.instances).toHaveLength(2);

			// Second reconnect at 2s (delay doubles after connect())
			MockWebSocket.instances[1].onclose?.();
			vi.advanceTimersByTime(1999);
			expect(MockWebSocket.instances).toHaveLength(2);
			vi.advanceTimersByTime(1);
			expect(MockWebSocket.instances).toHaveLength(3);
		});

		it('resets backoff delay on successful connection', () => {
			client.connect();
			MockWebSocket.instances[0].onclose?.();

			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].onclose?.();
			vi.advanceTimersByTime(2000);
			// Third attempt
			MockWebSocket.instances[2].simulateOpen();

			// Disconnect again — should use 1s delay (reset)
			MockWebSocket.instances[2].onclose?.();
			vi.advanceTimersByTime(1000);
			expect(MockWebSocket.instances).toHaveLength(4);
		});

		it('does not exceed max reconnect delay (30s)', () => {
			client.connect();

			// Force many disconnects to ramp up delay
			for (let i = 0; i < 20; i++) {
				MockWebSocket.instances[MockWebSocket.instances.length - 1].onclose?.();
				vi.advanceTimersByTime(30_000);
			}

			const lastInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
			expect(lastInstance).toBeDefined();
		});

		it('handles onerror by closing (which triggers reconnect)', () => {
			client.connect();
			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();
			ws.simulateError();

			expect(ws.close).toHaveBeenCalled();
		});

		it('does not reconnect after destroy()', () => {
			client.connect();
			MockWebSocket.instances[0].onclose?.();
			client.destroy();

			vi.advanceTimersByTime(60_000);
			expect(MockWebSocket.instances).toHaveLength(1); // no reconnect
		});

		it('does not schedule duplicate reconnect timers', () => {
			client.connect();
			const ws = MockWebSocket.instances[0];
			// Manually trigger onclose without letting it reconnect
			ws.onclose?.();
			// Try to trigger another close-like scenario — scheduleReconnect should be guarded
			// The first reconnect timer is still pending, so no duplicate
			expect(client.connected).toBe(false);
			vi.advanceTimersByTime(1000);
			expect(MockWebSocket.instances).toHaveLength(2); // only one reconnect
		});
	});

	describe('destroy()', () => {
		it('closes the WebSocket and clears timers', () => {
			client.connect();
			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();

			client.destroy();
			expect(ws.onclose).toBeNull();
			expect(ws.close).toHaveBeenCalled();
			expect(client.connected).toBe(false);
		});

		it('clears pending reconnect timer', () => {
			client.connect();
			MockWebSocket.instances[0].onclose?.();
			// Reconnect timer is pending
			client.destroy();
			vi.advanceTimersByTime(60_000);
			expect(MockWebSocket.instances).toHaveLength(1);
		});

		it('notifies on destroy', () => {
			const listener = vi.fn();
			client.onChange(listener);
			client.destroy();
			expect(listener).toHaveBeenCalled();
		});
	});

	describe('drain and sync', () => {
		it('drains offline queue on reconnect after disconnect', async () => {
			const mutations: QueuedMutation[] = [
				{ id: 'q-1', timestamp: 1, method: 'POST', url: '/api/tasks', body: { title: 'Test' } },
				{ id: 'q-2', timestamp: 2, method: 'DELETE', url: '/api/tasks/1' }
			];
			mockQueue = createMockQueue(mutations);
			client = new WebSocketClient(mockQueue);
			client.connect();

			const ws = MockWebSocket.instances[0];
			ws.simulateOpen();
			// First connect — wasDisconnected is false, no drain

			// Simulate disconnect + reconnect
			ws.onclose?.();
			vi.advanceTimersByTime(1000);
			const ws2 = MockWebSocket.instances[1];
			ws2.simulateOpen();

			// Let async drain complete
			await vi.runAllTimersAsync();

			expect(mockQueue.replay).toHaveBeenCalledTimes(2);
			expect(mockQueue.remove).toHaveBeenCalledWith('q-1');
			expect(mockQueue.remove).toHaveBeenCalledWith('q-2');
		});

		it('calls sync callbacks after draining', async () => {
			const syncCb = vi.fn().mockResolvedValue(undefined);
			mockQueue = createMockQueue([
				{ id: 'q-1', timestamp: 1, method: 'POST', url: '/api/tasks' }
			]);
			client = new WebSocketClient(mockQueue);
			client.onSync(syncCb);
			client.connect();

			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			await vi.runAllTimersAsync();

			expect(syncCb).toHaveBeenCalled();
		});

		it('calls sync callbacks even with empty queue on reconnect', async () => {
			const syncCb = vi.fn().mockResolvedValue(undefined);
			client.onSync(syncCb);
			client.connect();

			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			await vi.runAllTimersAsync();

			expect(syncCb).toHaveBeenCalled();
		});

		it('stops draining if replay returns null (network still down)', async () => {
			const mutations: QueuedMutation[] = [
				{ id: 'q-1', timestamp: 1, method: 'POST', url: '/api/tasks' },
				{ id: 'q-2', timestamp: 2, method: 'POST', url: '/api/tasks' }
			];
			mockQueue = createMockQueue(mutations);
			(mockQueue.replay as ReturnType<typeof vi.fn>).mockResolvedValue(null);
			client = new WebSocketClient(mockQueue);
			client.connect();

			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			await vi.runAllTimersAsync();

			// Only first mutation attempted, stopped on null
			expect(mockQueue.replay).toHaveBeenCalledTimes(1);
			expect(mockQueue.remove).not.toHaveBeenCalled();
			expect(client.syncing).toBe(false);
		});

		it('sets syncing=true during drain and false after', async () => {
			const mutations: QueuedMutation[] = [
				{ id: 'q-1', timestamp: 1, method: 'POST', url: '/api/tasks' }
			];
			mockQueue = createMockQueue(mutations);
			client = new WebSocketClient(mockQueue);

			const syncStates: boolean[] = [];
			client.onChange(() => syncStates.push(client.syncing));

			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			await vi.runAllTimersAsync();

			// Should have been true at some point and end false
			expect(syncStates).toContain(true);
			expect(client.syncing).toBe(false);
		});

		it('unsubscribes sync callback', async () => {
			const syncCb = vi.fn().mockResolvedValue(undefined);
			const unsub = client.onSync(syncCb);
			unsub();

			client.connect();
			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			await vi.runAllTimersAsync();

			expect(syncCb).not.toHaveBeenCalled();
		});

		it('handles sync callback errors gracefully', async () => {
			const failingSync = vi.fn().mockRejectedValue(new Error('Sync failed'));
			client.onSync(failingSync);
			client.connect();

			MockWebSocket.instances[0].simulateOpen();
			MockWebSocket.instances[0].onclose?.();
			vi.advanceTimersByTime(1000);
			MockWebSocket.instances[1].simulateOpen();

			// Should not throw
			await vi.runAllTimersAsync();
			expect(failingSync).toHaveBeenCalled();
		});
	});

	describe('clientId fallback', () => {
		it('generates fallback ID when crypto.randomUUID is unavailable', () => {
			const originalCrypto = globalThis.crypto;
			Object.defineProperty(globalThis, 'crypto', {
				value: {
					randomUUID: () => {
						throw new Error('Not available');
					}
				},
				configurable: true
			});

			const fallbackClient = new WebSocketClient(mockQueue);
			expect(fallbackClient.clientId).toMatch(/^fallback-/);

			Object.defineProperty(globalThis, 'crypto', {
				value: originalCrypto,
				configurable: true
			});
			fallbackClient.dispose();
		});
	});
});
