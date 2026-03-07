import { ChangeNotifier } from '$lib/domain/change-notifier';
import type { OfflineQueue } from './offline-queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageHandler = (payload: any) => void;
type SyncCallback = () => Promise<void>;

const MAX_RECONNECT_DELAY = 30_000;

export class WebSocketClient extends ChangeNotifier {
	readonly clientId: string;

	private _connected = false;
	private _syncing = false;
	private handlers = new Map<string, Set<MessageHandler>>();
	private syncCallbacks = new Set<SyncCallback>();
	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectDelay = 1000;
	private destroyed = false;
	private wasDisconnected = false;

	constructor(private offlineQueue: OfflineQueue) {
		super();
		// Generate a stable client ID per session
		try {
			this.clientId = crypto.randomUUID();
		} catch {
			// crypto.randomUUID() requires a secure context (HTTPS/localhost).
			// Fall back to a manual ID for LAN HTTP connections.
			this.clientId =
				'fallback-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
		}
	}

	get connected(): boolean {
		return this._connected;
	}

	get syncing(): boolean {
		return this._syncing;
	}

	connect(): void {
		if (this.destroyed) return;

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const url = `${protocol}//${location.host}/ws`;

		try {
			this.ws = new WebSocket(url);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this._connected = true;
			this.reconnectDelay = 1000;
			this.notifyChanges();

			this.ws?.send(JSON.stringify({ type: 'init', clientId: this.clientId }));

			if (this.wasDisconnected) {
				this.wasDisconnected = false;
				this.drainQueueAndRefresh();
			}
		};

		this.ws.onmessage = (event: MessageEvent) => {
			try {
				const msg = JSON.parse(event.data);
				const handlerSet = this.handlers.get(msg.type);
				if (handlerSet) {
					for (const handler of handlerSet) {
						handler(msg.payload);
					}
				}
			} catch {
				// Ignore malformed messages
			}
		};

		this.ws.onclose = () => {
			this._connected = false;
			this.wasDisconnected = true;
			this.ws = null;
			this.notifyChanges();
			/* istanbul ignore next -- defensive: destroy() nullifies onclose before close() */
			if (!this.destroyed) this.scheduleReconnect();
		};

		this.ws.onerror = () => {
			this.ws?.close();
		};
	}

	destroy(): void {
		this.destroyed = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
		this._connected = false;
		this.notifyChanges();
	}

	onMessage(type: string, handler: MessageHandler): () => void {
		let set = this.handlers.get(type);
		if (!set) {
			set = new Set();
			this.handlers.set(type, set);
		}
		set.add(handler);
		return () => {
			set!.delete(handler);
			if (set!.size === 0) this.handlers.delete(type);
		};
	}

	onSync(callback: SyncCallback): () => void {
		this.syncCallbacks.add(callback);
		return () => {
			this.syncCallbacks.delete(callback);
		};
	}

	private scheduleReconnect(): void {
		/* istanbul ignore next -- guard: destroyed checked by caller, timer dedup is defensive */
		if (this.destroyed || this.reconnectTimer) return;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
			this.connect();
		}, this.reconnectDelay);
	}

	private async drainQueueAndRefresh(): Promise<void> {
		const queue = await this.offlineQueue.getAll();
		if (queue.length === 0) {
			// No queued mutations, but still refresh to pick up remote changes
			await this.callSyncCallbacks();
			return;
		}

		this._syncing = true;
		this.notifyChanges();

		for (const mutation of queue) {
			const res = await this.offlineQueue.replay(mutation);
			if (res === null) {
				// Network still down
				this._syncing = false;
				this.notifyChanges();
				return;
			}
			await this.offlineQueue.remove(mutation.id);
		}

		await this.callSyncCallbacks();

		this._syncing = false;
		this.notifyChanges();
	}

	private async callSyncCallbacks(): Promise<void> {
		for (const callback of this.syncCallbacks) {
			try {
				await callback();
			} catch {
				// Refresh failed — will try again next reconnect
			}
		}
	}
}
