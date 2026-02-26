---
"prosys": minor
---

fix: resolve stale UI after app update and eliminate port conflicts

- Fix WKWebView cache directory path (was targeting `com.prosys.app` instead of `prosys`)
- Add `Cache-Control: no-store` on HTML responses as defense-in-depth
- Hide window during startup to prevent "file not found" flash (Tauri splashscreen pattern)
- Replace hardcoded port 3000 with dynamic OS-assigned port, persisted across restarts
