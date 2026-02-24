# prosys

## 0.2.5

### Patch Changes

- b7dd4c4: Codesign native .node binaries in server bundle for Apple notarization

## 0.2.4

### Patch Changes

- 11a10f5: Add macOS code signing and notarization to release workflow

## 0.2.3

### Patch Changes

- 5c69469: Add esbuild as explicit devDependency for CI builds

## 0.2.2

### Patch Changes

- be94110: Add copyright notice to app footer

## 0.2.1

### Patch Changes

- 9919bd6: Fix release pipeline: use PAT for tag push and include changelog in draft release

  - Tags pushed by GITHUB_TOKEN don't trigger other workflows — switched to RELEASE_TOKEN (PAT)
  - Draft releases now include the CHANGELOG.md content for the version

- 4fc041e: Add app name to version footer

## 0.2.0

### Minor Changes

- f2879d2: Add update notifications and version display

  - Tauri updater: checks GitHub Releases on launch, shows banner to download and restart
  - PWA update detection: listens for service worker changes, shows refresh banner for mobile clients
  - CI release pipeline: GitHub Actions workflows for automated versioning and Tauri builds
  - App version displayed in footer, injected at build time from package.json
