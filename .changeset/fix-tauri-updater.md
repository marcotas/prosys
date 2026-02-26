---
"prosys": patch
---

Fix Tauri updater not showing update banner: use correct Tauri v2 IPC detection (`__TAURI_INTERNALS__` instead of `__TAURI__`) and add remote capability for localhost to allow updater/process plugin IPC from the production Node.js server URL.
