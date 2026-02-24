# macOS Code Signing & Notarization

How ProSys is signed and notarized for distribution outside the Mac App Store.

## Why It's Required

Without a valid Developer ID certificate:
- macOS Gatekeeper blocks the app with **"damaged and cannot be opened"**
- The quarantine attribute (`com.apple.quarantine`) is set on any file downloaded from the internet
- Workaround: `xattr -cr /Applications/ProSys.app` — but this is unacceptable for end users

## Certificate Setup (One-Time)

1. **Create a "Developer ID Application" certificate** in [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list)
   - Generate a CSR from Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Upload the CSR in the Apple Developer portal → download the `.cer` file
   - Double-click to install in Keychain (must go into the **login** keychain, not System)

2. **Export as `.p12`**: Keychain Access → My Certificates → expand certificate → right-click private key → Export

3. **Convert to base64**: `base64 -i certificate.p12 | pbcopy`

4. **App-specific password**: [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords

5. **Team ID**: [Apple Developer → Membership](https://developer.apple.com/account#MembershipDetailsCard)

## How Signing Works in CI

### Certificate Import (release.yml)

The workflow creates a temporary keychain, imports the `.p12`, and makes it available to `codesign`:

```yaml
- name: Import Apple Developer Certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -t 3600 -u build.keychain
    security import certificate.p12 -k build.keychain \
      -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: \
      -s -k "$KEYCHAIN_PASSWORD" build.keychain
    security find-identity -v -p codesigning build.keychain
    rm certificate.p12
```

### Signing Env Vars for Tauri

Tauri picks these up automatically — no `tauri.conf.json` changes needed:

| Env Var | Purpose |
|---------|---------|
| `APPLE_SIGNING_IDENTITY` | Identity string for `codesign` (e.g. `Developer ID Application: ...`) |
| `APPLE_CERTIFICATE` | Base64 `.p12` (also needed by `tauri-action`) |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export password |
| `APPLE_ID` | Apple ID for notarization submission |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Team ID for notarization |

### Native Addon Signing

**Critical**: Apple notarization requires **every binary** in the `.app` bundle to be signed — including native `.node` addons. Tauri only signs its own binaries, not resource files.

`prepare-server-bundle.js` handles this in step 5:

```js
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;
if (signingIdentity) {
    signNativeBinaries(outDir, signingIdentity);
}

function signNativeBinaries(dir, identity) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            signNativeBinaries(fullPath, identity);
        } else if (entry.name.endsWith('.node') || entry.name.endsWith('.dylib')) {
            execSync(
                `codesign --force --sign "${identity}" --timestamp --options runtime "${fullPath}"`,
                { stdio: 'inherit' }
            );
        }
    }
}
```

The key flags:
- `--force` — re-signs even if already signed (needed for pre-signed binaries)
- `--timestamp` — includes a secure timestamp (required by Apple notarization)
- `--options runtime` — enables hardened runtime (required by Apple notarization)

**If you add more native addons**: They'll be automatically picked up by this recursive scan as long as they're in the server-bundle directory.

## Keychain Import Error -25294

**Symptom**: Double-clicking the `.cer` file shows "Unable to import — Error: -25294"

**Cause**: The `.cer` can't find its matching private key. The CSR generation created the private key in the **login** keychain, but the import is going to a different keychain.

**Fix**: Open Keychain Access, select **login** in the sidebar, then drag the `.cer` file onto the window (or File → Import Items with destination set to "login").

## Two Kinds of Signing

ProSys uses two separate signing mechanisms — don't confuse them:

| | Tauri Updater Signing | Apple Code Signing |
|---|---|---|
| **Purpose** | Verify update integrity | macOS Gatekeeper / notarization |
| **Key** | Ed25519 keypair (`TAURI_SIGNING_PRIVATE_KEY`) | Developer ID certificate (`.p12`) |
| **Config** | `plugins.updater.pubkey` in `tauri.conf.json` | `APPLE_SIGNING_IDENTITY` env var |
| **Public key in repo?** | Yes (safe, meant to be public) | No (only the identity string) |
| **Artifacts** | `.sig` files + `latest.json` | Signed `.app` + notarization ticket |
