# Platform (Tauri + PWA + mDNS)

- **Type**: feature
- **Depends on**: 00-setup
- **Files owned**: `src-tauri/**`, `static/manifest.json`
- **Interfaces exposed**: Tauri desktop app that runs the SvelteKit server; PWA manifest for mobile install; mDNS broadcast for auto-discovery
- **Interfaces consumed**: SvelteKit build output; server entry point

## Description

Build the platform layer for desktop and mobile deployment:

1. **Tauri v2 shell** — Initialize a Tauri v2 project (`src-tauri/`). Configure it to:
   - Spawn the SvelteKit Node.js server as a sidecar process on app launch
   - Load the SvelteKit URL in the Tauri webview
   - Shut down the server on app quit
   - Set the window title to "ProSys" with appropriate icon

2. **mDNS broadcast** — On server start, broadcast the service via mDNS (Bonjour) using `bonjour-service`. Advertise as `_prosys._tcp` on the server's port. Other devices on the LAN can discover the host automatically.

3. **PWA manifest** — Create `static/manifest.json` with app name, icons, theme color, and `display: standalone`. Add the manifest link to `app.html`. This allows iOS users to "Add to Home Screen" for an app-like experience.

4. **Network binding** — Ensure the SvelteKit server binds to `0.0.0.0` (not just localhost) so LAN devices can connect.

## Acceptance Criteria

- `pnpm tauri dev` launches the Tauri window showing the ProSys dashboard
- SvelteKit server starts automatically when Tauri app opens
- SvelteKit server stops when Tauri app closes
- A phone on the same LAN can access the app via the host's IP + port
- mDNS broadcast is visible (e.g. `dns-sd -B _prosys._tcp` shows the service)
- On iOS Safari, "Add to Home Screen" installs a PWA with the correct icon and name
- PWA opens in standalone mode (no Safari chrome)
