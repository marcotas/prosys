# prosys

## 0.2.0

### Minor Changes

- f2879d2: Add update notifications and version display

  - Tauri updater: checks GitHub Releases on launch, shows banner to download and restart
  - PWA update detection: listens for service worker changes, shows refresh banner for mobile clients
  - CI release pipeline: GitHub Actions workflows for automated versioning and Tauri builds
  - App version displayed in footer, injected at build time from package.json
