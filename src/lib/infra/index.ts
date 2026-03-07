import { ApiClient } from './api-client';
import { OfflineQueue } from './offline-queue';
import { WebSocketClient } from './ws-client';

export { ApiClient } from './api-client';
export { OfflineQueue } from './offline-queue';
export type { QueuedMutation } from './offline-queue';
export { WebSocketClient } from './ws-client';
export { optimisticAction, isNetworkError } from './optimistic-action';
export type { MutationPlan, OfflinePayload } from './optimistic-action';

// ── Singleton instances ─────────────────────────────────

export const apiClient = new ApiClient();
export const offlineQueue = new OfflineQueue();
export const wsClient = new WebSocketClient(offlineQueue);

apiClient.setClientId(wsClient.clientId);

/** Backward-compat helper for stores not yet migrated to ApiClient. */
export function wsHeaders(): Record<string, string> {
	return wsClient.clientId ? { 'X-WS-Client-Id': wsClient.clientId } : {};
}
