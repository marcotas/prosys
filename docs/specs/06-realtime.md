# Real-Time Sync

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src/lib/server/ws.ts`, `src/lib/stores/ws.svelte.ts`, `src/hooks.server.ts`
- **Interfaces exposed**: `wsServer.broadcast(message: WSMessage)` on server; `wsStore` on client with `connected` state and `onMessage` dispatcher
- **Interfaces consumed**: `WSMessage` type from setup; DB connection

## Description

Build the WebSocket real-time sync layer:

1. **Server** — `ws.ts` creates a WebSocket server (using `ws` library). `hooks.server.ts` intercepts upgrade requests to `/ws` and hands them to the WS server. The server maintains a set of connected clients.

2. **Broadcast** — `wsServer.broadcast(msg)` sends a `WSMessage` to all connected clients except the sender. API routes call `broadcast()` after successful mutations (create/update/delete/reorder/toggle).

3. **Client** — `ws.svelte.ts` connects to `ws://host:port/ws` on mount. Exposes reactive `connected` state. Dispatches incoming messages to registered handlers. Auto-reconnects on disconnect with exponential backoff.

4. **Message format** — All messages follow the `WSMessage` union type from `types.ts`. Each message has a `type` string and a `payload` object. Feature stores register handlers for their message types.

## Acceptance Criteria

- WebSocket connection established on page load
- Connection indicator shows connected/disconnected state
- Creating a task on tab A appears on tab B without refresh
- Toggling a habit on tab A updates tab B
- Deleting a member on tab A updates tab B
- Reordering tasks on tab A reflects on tab B
- Auto-reconnects after network interruption (simulated by killing/restarting server)
- No duplicate updates when the mutation originates from the same client
