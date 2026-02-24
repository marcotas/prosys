# CI/CD Release Pipeline

How automated versioning, tagging, and release building works for ProSys.

## Pipeline Overview

```
Developer pushes changeset → main
  ↓
version.yml (Version & Tag)
  ├─ changesets present → opens "Version Packages" PR
  └─ no changesets (PR was just merged) → tags vX.Y.Z → dispatches release.yml
  ↓
release.yml (Release)
  ├─ imports Apple Developer certificate
  ├─ builds Tauri app (with code signing + notarization)
  └─ creates draft GitHub Release with .dmg + updater artifacts
```

## Key Files

| File | Role |
|------|------|
| `.github/workflows/version.yml` | Changesets → version PR → tag → dispatch release |
| `.github/workflows/release.yml` | Tauri build → sign → notarize → draft GitHub Release |
| `scripts/sync-version.js` | Syncs `package.json` version → `tauri.conf.json` + `Cargo.toml` |
| `.changeset/` | Changeset entries (consumed on version PR merge) |

## Changesets Workflow

1. **Create a changeset** alongside every code change:
   ```bash
   pnpm changeset
   # or manually create .changeset/<name>.md with frontmatter
   ```
2. Push to `main` — `version.yml` detects the changeset and opens a "Version Packages" PR
3. Merge the PR — changesets are consumed, `CHANGELOG.md` updated, version bumped
4. `version.yml` runs again, sees no changesets → tags and dispatches release

### Changeset file format

```md
---
"prosys": patch   # or minor / major
---

Description of the change
```

### Version sync

The `version` script in `package.json` is:
```json
"version": "changeset version && node scripts/sync-version.js"
```

`sync-version.js` reads the version from `package.json` and writes it to:
- `src-tauri/tauri.conf.json` (`.version`)
- `src-tauri/Cargo.toml` (`[package] version`)

## GitHub Actions Pitfalls

### GITHUB_TOKEN tags don't trigger other workflows

**Problem**: Tags pushed using `GITHUB_TOKEN` do NOT trigger `on: push: tags` in other workflows. This is a GitHub security measure to prevent recursive workflow runs.

**Fix**: Use `workflow_dispatch` as the trigger mechanism. `version.yml` explicitly calls:
```bash
gh workflow run release.yml --repo $REPO --ref "$TAG"
```
This requires a **Personal Access Token** (PAT) stored as `RELEASE_TOKEN` secret with `contents:write` scope. Fine-grained PATs also don't reliably trigger push events — `workflow_dispatch` is the only reliable cross-workflow trigger.

### "GitHub Actions is not permitted to create or approve pull requests"

**Fix**: Enable in repo Settings → Actions → General → Workflow permissions → check "Allow GitHub Actions to create and approve pull requests".

### `pnpm exec` can't find transitive dependencies in CI

**Problem**: `pnpm exec esbuild` fails on CI because `esbuild` is only a transitive dependency of Vite, not a direct dependency. pnpm's strict isolation means it's not in the PATH.

**Fix**: Add `esbuild` as an explicit `devDependency`:
```bash
pnpm add -D esbuild
```

### Drizzle migration meta files must be tracked in git

**Problem**: `drizzle/meta/_journal.json` and snapshot files were in `.gitignore`. SvelteKit's build/postbuild analysis runs server-side code that imports Drizzle, which requires these files.

**Symptom**: `Error: Can't find meta/_journal.json file` during CI `pnpm build`.

**Fix**: Remove `drizzle/meta/` from `.gitignore` and track these files in git.

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `RELEASE_TOKEN` | PAT for cross-workflow dispatch (`gh workflow run`) |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key (for update artifact verification) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `KEYCHAIN_PASSWORD` | Random password for the temporary CI keychain |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAM_ID)` |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

## Release Artifacts

`tauri-action` with `createUpdaterArtifacts: true` produces:
- `ProSys_X.Y.Z_aarch64.dmg` — macOS disk image (for manual install)
- `ProSys.app.tar.gz` — compressed app bundle (for Tauri updater)
- `ProSys.app.tar.gz.sig` — signature file (verified against `updater.pubkey`)
- `latest.json` — manifest checked by the Tauri updater plugin

The updater endpoint in `tauri.conf.json` points to:
```
https://github.com/marcotas/prosys/releases/latest/download/latest.json
```

**Important**: Releases must be published (not draft) for the updater to find `latest.json`. After verifying a draft release, publish it to make it available to the updater.
