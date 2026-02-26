# Update Notifications

How ProSys notifies users about available updates on both desktop (Tauri) and mobile (PWA).

## Two Update Paths

| | Desktop (Tauri) | Mobile (PWA) |
|---|---|---|
| **Detection** | Tauri updater plugin checks GitHub Releases | Service Worker `controllerchange` event |
| **Trigger** | On app launch (`onMount` in `+layout.svelte`) | Automatic — browser detects new SW |
| **User action** | Click "Update & restart" → downloads + relaunches | Click "Refresh" → `window.location.reload()` |
| **Banner** | Blue `UpdateBanner` with version details | Blue `UpdateBanner` with generic message |

## Tauri Updater (Desktop)

### How it works

1. On mount, `+layout.svelte` checks for `__TAURI_INTERNALS__` on `window` (Tauri v2's IPC bridge — NOT `__TAURI__`, which requires `withGlobalTauri: true`)
2. Dynamically imports `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`
3. Calls `check()` → fetches `latest.json` from GitHub Releases endpoint
4. If update available: stores version + download function in state
5. User clicks banner → kills Node.js server via `kill_server` command → `downloadAndInstall()` + `relaunch()`

```ts
async function checkTauriUpdate() {
    try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const { relaunch } = await import('@tauri-apps/plugin-process');
        const update = await check();
        if (update) {
            tauriUpdate = {
                version: update.version,
                download: async () => {
                    await update.downloadAndInstall();
                    await relaunch();
                }
            };
        }
    } catch (e) {
        console.warn('[prosys] Update check failed:', e);
    }
}
```

### Why dynamic imports?

`@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` only work inside Tauri's webview. On PWA clients, these modules don't exist. Dynamic imports behind an `if ('__TAURI_INTERNALS__' in window)` guard prevent import errors on non-Tauri clients.

### Tauri config

```json
// tauri.conf.json
"plugins": {
    "updater": {
        "pubkey": "...",
        "endpoints": ["https://github.com/marcotas/prosys/releases/latest/download/latest.json"]
    }
}
```

The endpoint points to the **latest published** GitHub Release. Draft releases are invisible to this endpoint — you must publish the release for the updater to find it.

### Tauri plugins required

- `@tauri-apps/plugin-updater` — checks for updates, downloads, installs
- `@tauri-apps/plugin-process` — provides `relaunch()` capability
- Both added via `pnpm tauri add updater` and `pnpm tauri add process`
- Rust side: registered as `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_process::init())` in `lib.rs`
- Capabilities: `updater:default` and `process:default` permissions in `src-tauri/capabilities/desktop.json`
- Remote IPC: `"remote": { "urls": ["http://localhost:*"] }` in the capability — required because the production WebView navigates to `http://localhost:3000` (a non-Tauri origin). Without this, plugin IPC calls are blocked by Tauri v2's origin check.

## PWA Update (Mobile)

### How it works

1. On mount, `+layout.svelte` listens for `controllerchange` on `navigator.serviceWorker`
2. `controllerchange` fires when a new Service Worker takes control (via `skipWaiting()` + `clients.claim()`)
3. If a controller already existed (`hadController` guard), shows the update banner
4. User clicks "Refresh" → `window.location.reload()`

### The `hadController` guard

```ts
let hadController = !!navigator.serviceWorker.controller;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) {
        swUpdateAvailable = true;
    } else {
        hadController = true;
    }
});
```

**Why**: On the very first visit, there's no active Service Worker. When the SW installs and activates for the first time, `controllerchange` fires. Without this guard, the user would see a false "update available" banner on their first visit. The guard ensures the banner only shows when replacing an existing SW.

## Shared UpdateBanner Component

`src/lib/components/UpdateBanner.svelte` — used by both paths:
- Blue color scheme (distinct from green `PwaInstallBanner`)
- Fixed bottom position with `safe-area-inset-bottom` for iOS notch
- Slide-up animation
- Props: `message`, `detail?`, `actionLabel`, `onAction`, `onDismiss`
- Each banner has independent dismiss state (`tauriUpdateDismissed`, `swUpdateDismissed`)

## Build-Time Version Injection

The app version shown in the footer is injected at build time:

```ts
// vite.config.ts
define: { __APP_VERSION__: JSON.stringify(pkg.version) }

// src/app.d.ts
declare const __APP_VERSION__: string;

// +layout.svelte footer
v{__APP_VERSION__}
```

This reads from `package.json` at build time, so the version is always accurate for the built artifact. No runtime API call needed.
