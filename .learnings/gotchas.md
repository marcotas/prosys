# Gotchas

Non-obvious pitfalls discovered through debugging, with cause and fix for each.

## 1. Svelte 5 `$state<Map>` reactivity

**Symptom**: Optimistic updates modify the store but `$derived` in components never re-fires.

**Cause**: `$state<Map>()` creates a deep reactive proxy. When the entire Map is replaced (which happens on every mutation), `$derived` computations in other components may not detect the change.

**Fix**: Use `$state.raw<Map>()` for collections that are replaced on mutation. This switches to reference-level tracking.

```ts
// BAD -- deep proxy, derived may not fire
let weekCache = $state<Map<string, Task[]>>(new Map());

// GOOD -- reference tracking, works correctly
let weekCache = $state.raw<Map<string, Task[]>>(new Map());
```

**Affected files**: `src/lib/stores/tasks.svelte.ts`, `src/lib/stores/habits.svelte.ts`

## 2. Vite SSR externals: dev vs production

**Symptom**: Dev: `require is not defined`. Production: `ERR_MODULE_NOT_FOUND: Cannot find package 'ws'`.

**Cause**: CJS packages (`ws`, `qrcode`) use `require()` internally. In dev, Vite's ESM SSR loader can't handle this. In production, Vite transforms CJS to ESM during the build -- but if the package is marked `external`, it stays as a bare `import` and must exist in `node_modules/`.

**Fix**: Externalize CJS packages only in dev mode. In production, let Vite bundle them.

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  ssr: {
    noExternal: true,
    external: command === 'serve'
      ? ['better-sqlite3', 'ws', 'qrcode']   // dev: keep external
      : ['better-sqlite3']                     // prod: only native addons
  }
}));
```

**Rule**: Native addons (e.g., `better-sqlite3`) must ALWAYS be external. Pure-JS packages should only be external in dev if they cause CJS issues.

## 3. `crypto.randomUUID()` on LAN HTTP

**Symptom**: `TypeError: crypto.randomUUID is not a function` on mobile Safari.

**Cause**: `crypto.randomUUID()` requires a secure context (HTTPS or localhost). LAN connections via `http://10.x.x.x` are not secure contexts.

**Fix**: Wrap in try/catch with a fallback.

```ts
try {
  clientId = crypto.randomUUID();
} catch {
  clientId = 'fb-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

**Affected file**: `src/lib/stores/ws.svelte.ts`

## 4. App bundle is ephemeral

**Symptom**: Database and user data lost after every `pnpm tauri:build`.

**Cause**: `ProSys.app/Contents/Resources/` is recreated from scratch on every build. Any files written inside the bundle (database, config) are destroyed.

**Fix**: Store persistent data outside the bundle via `PROSYS_DATA_DIR` env var, set by Tauri's `app.path().app_data_dir()` (resolves to `~/Library/Application Support/com.prosys.app/`).

**Affected files**: `src-tauri/src/lib.rs`, `src/lib/server/db/index.ts`

## 5. SvelteKit API routes skip layout loaders

**Symptom**: `SqliteError: no such table: family_members` on direct API call.

**Cause**: `runMigrations()` runs as module-level code in `+layout.server.ts`, which only executes on page loads. API routes (`+server.ts`) do NOT go through layout server loaders. A direct API call (e.g., curl) before any page has loaded hits an uninitialized database.

**Implication**: In practice, the Tauri webview loads a page first (triggering migrations), so this only matters for direct API testing. Be aware when testing endpoints via curl.

## 6. esbuild CJS-to-ESM banner

**Context**: The production `server.js` is bundled by esbuild with `--format=esm`. CJS packages bundled into ESM lose access to `require()`.

**Fix**: The banner in `scripts/prepare-server-bundle.js` injects a `require()` polyfill:

```js
const banner = "import { createRequire as __createRequire } from 'module';"
             + "const require = __createRequire(import.meta.url);";
```

**Rule**: If adding new CJS dependencies to `server.js`, they will be handled by this banner. No action needed unless the dependency does something unusual with `require.resolve()` paths.

## 7. pnpm strict isolation for native addons

**Context**: pnpm's strict `node_modules` structure means transitive dependencies of native addons aren't hoisted.

**Fix**: `prepare-server-bundle.js` resolves each package via chained `createRequire()` from its parent package's context:

```
better-sqlite3 (resolved from project root)
  -> bindings (resolved from better-sqlite3's context)
    -> file-uri-to-path (resolved from bindings' context)
```

**Rule**: When adding new native addon dependencies, add them to the copy chain in `prepare-server-bundle.js` following this pattern.

## 8. `touch-action: pan-y` scope matters for nested scroll containers

**Symptom**: `touch-pan-y` on a DnD zone inside a horizontal scroll container blocks carousel swipe. Or: `touch-pan-y` on a `<tbody>` blocks horizontal table scroll.

**Cause**: `touch-action: pan-y` tells the browser "only handle vertical panning — I'll handle horizontal." This prevents ANY ancestor horizontal scroll from working through that element.

**Rule**: Never apply `touch-pan-y` to large container zones (DnD zones, tbody). Instead, apply it narrowly to the specific swipeable elements (the div with `ontouchstart`) so only that element's horizontal touch is claimed by JS, while the surrounding area allows native scroll.

**Affected files**: `src/lib/components/DayCard.svelte`, `src/lib/components/HabitTracker.svelte`

## 9. Window-level touch listeners should be lazy

**Symptom**: 24 permanent non-passive `touchmove` listeners on `window` causing scroll jank on mobile.

**Cause**: Each DayCard (7) and HabitTracker (1) registered their own `touchmove`/`touchend`/`touchcancel` on `window` via `$effect` for the lifetime of the component, even when no swipe was active.

**Fix**: Register listeners on `touchstart` (when swipe begins), remove them on `touchend`/`touchcancel` (when swipe ends). Keep a cleanup-only `$effect` for unmount safety. At rest: 0 window listeners. During swipe: 3 listeners from the one active component.

```ts
function onTouchStart(e, id) {
  // ... set swipeState ...
  addSwipeListeners();
}
function onTouchEnd() {
  // ... finalize swipe ...
  removeSwipeListeners();
}
$effect(() => () => removeSwipeListeners()); // unmount safety
```

**Affected files**: `src/lib/components/DayCard.svelte`, `src/lib/components/HabitTracker.svelte`

## 10. `scrollIntoView` defaults `block` to `"start"`

**Symptom**: Auto-scrolling to today's card on mobile jumps the whole page vertically.

**Cause**: `scrollIntoView({ inline: "center" })` uses default `block: "start"`, which scrolls the element to the top of the viewport.

**Fix**: Always specify `block: "nearest"` when you only want horizontal scroll — it only scrolls vertically if the element is outside the viewport.

```ts
// BAD — page jumps vertically
todayCard.scrollIntoView({ inline: "center", behavior: "instant" });

// GOOD — only scrolls horizontally
todayCard.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
```

**Affected file**: `src/routes/+page.svelte`

## 11. mDNS `bonjour-service` probe fails after unclean shutdown

**Symptom**: `Error: Service name is already in use on the network` on `pnpm dev`.

**Cause**: `bonjour.publish()` probes the network for name conflicts. A killed dev server leaves a stale mDNS record that isn't unpublished. The `buildEnd` Vite hook doesn't fire on kill/crash.

**Fix**: Use `probe: false` in dev mode to skip the name-conflict check. Acceptable because only one dev instance runs at a time.

```ts
bonjour.publish({
  name: 'ProSys',
  type: 'prosys',
  protocol: 'tcp',
  port,
  probe: false  // skip network probe — avoids stale-record conflicts
});
```

**Affected file**: `vite.config.ts`

## 12. Tauri `window.eval()` is fire-and-forget

**Symptom**: Version file written before async JS cache-clearing completes. If eval fails at Rust level, no navigation occurs — user sees blank page.

**Cause**: `window.eval()` dispatches JS to the WebView and returns immediately. It cannot await async JS promises. If it returns `Err`, the JS never ran at all (including `window.location.replace()`).

**Fix**: (1) Always add a fallback `window.navigate()` in the `Err` branch. (2) Don't silently discard eval errors with `let _ =`. (3) In the JS catch block, log errors instead of swallowing them.

```rust
if let Err(e) = window.eval(r#"(async function() { ... })();"#) {
    eprintln!("[prosys] cache-clear eval failed: {e}");
    let _ = window.navigate("http://localhost:3000".parse().unwrap());
}
```

**Affected file**: `src-tauri/src/lib.rs`

## 13. GITHUB_TOKEN tags don't trigger other workflows

**Symptom**: `version.yml` pushes a tag, but `release.yml` (triggered by `on: push: tags`) never runs.

**Cause**: GitHub prevents recursive workflow runs. Tags (and pushes) created using `GITHUB_TOKEN` intentionally don't trigger other workflows. Fine-grained PATs also don't reliably trigger push-based events.

**Fix**: Use `workflow_dispatch` as the cross-workflow trigger. `version.yml` explicitly dispatches `release.yml` via `gh workflow run` using a classic PAT (`RELEASE_TOKEN` secret) with `contents:write` scope.

```yaml
# version.yml
- name: Trigger release build
  env:
    GH_TOKEN: ${{ secrets.RELEASE_TOKEN }}
  run: gh workflow run release.yml --repo $REPO --ref "$TAG"
```

**Affected files**: `.github/workflows/version.yml`, `.github/workflows/release.yml`

## 14. `pnpm exec` can't find transitive dependencies in CI

**Symptom**: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "esbuild" not found` on CI.

**Cause**: `esbuild` was only a transitive dependency of Vite. pnpm's strict isolation means `pnpm exec esbuild` can't find binaries from transitive deps. Works locally because the binary happens to be hoisted.

**Fix**: Add `esbuild` as an explicit `devDependency`: `pnpm add -D esbuild`.

**Rule**: Any CLI tool used via `pnpm exec` in scripts must be a direct dependency, not transitive.

**Affected files**: `package.json`, `scripts/prepare-server-bundle.js`

## 15. Drizzle migration meta files must be in git

**Symptom**: `Error: Can't find meta/_journal.json file` during CI build.

**Cause**: `drizzle/meta/` was in `.gitignore`, but SvelteKit's build runs server-side code that imports Drizzle ORM, which requires `meta/_journal.json` and snapshot files at build time — even if no migration is being run.

**Fix**: Remove `drizzle/meta/` from `.gitignore` and track these files in git. The actual SQLite database (`*.db`) should remain gitignored.

**Affected files**: `.gitignore`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`

## 16. Apple notarization requires all binaries signed

**Symptom**: Notarization fails with "The binary is not signed with a valid Developer ID certificate" pointing to `better_sqlite3.node`.

**Cause**: Tauri signs its own executables and frameworks, but NOT resource files. The `better_sqlite3.node` native addon is copied into `server-bundle/node_modules/` as a resource — Tauri doesn't know it's an executable binary.

**Fix**: `prepare-server-bundle.js` recursively finds and codesigns all `.node` and `.dylib` files when `APPLE_SIGNING_IDENTITY` is set (CI only). Must use `--timestamp --options runtime` flags for notarization compliance.

```js
execSync(
    `codesign --force --sign "${identity}" --timestamp --options runtime "${fullPath}"`,
    { stdio: 'inherit' }
);
```

**Rule**: If adding new native addon dependencies, ensure their binaries end with `.node` or `.dylib` — the recursive scan will pick them up automatically.

**Affected file**: `scripts/prepare-server-bundle.js`

## 17. Keychain import error -25294 on macOS

**Symptom**: Double-clicking a `.cer` file shows "Unable to import — Error: -25294".

**Cause**: The certificate can't find its matching private key. The CSR was generated in the **login** keychain, but the `.cer` import targeted a different keychain (e.g., System or Local Items).

**Fix**: Open Keychain Access, select **login** in the sidebar, then drag the `.cer` onto the window. Both the private key (from CSR) and certificate must be in the same keychain.

## 18. Drizzle `.set()` uses JS property names, not SQL column names

**Symptom**: PATCH request returns 200 but the column value is never updated in the database.

**Cause**: Drizzle's `.update().set()` expects the JavaScript property name from the schema definition, not the raw SQL column name. Using the SQL name silently creates a new property in the update object that Drizzle ignores.

```ts
// Schema: memberId: text('member_id')

// BAD — 'member_id' is the SQL column name, Drizzle ignores it
updates.member_id = memberId;

// GOOD — 'memberId' is the JS property name Drizzle recognizes
updates.memberId = memberId;
```

**Affected file**: `src/routes/api/tasks/[id]/+server.ts`

## 19. `window.location.href` loses in-memory Svelte store state

**Symptom**: Navigating from the planner to a member's dashboard always shows the first member instead of the selected one.

**Cause**: `window.location.href = '/'` triggers a full page reload, destroying all in-memory Svelte store state. The server `load` function then returns default data (first member), overriding any prior `memberStore.select()` call.

**Fix**: Use SvelteKit's `goto()` for client-side navigation between routes. This preserves store state across route transitions. Also make `hydrate()` preserve existing valid selections instead of always overriding.

```ts
// BAD — full reload, store state lost
memberStore.select(id);
window.location.href = '/';

// GOOD — client-side navigation, store state preserved
import { goto } from '$app/navigation';
memberStore.select(id);
goto('/');
```

**Affected files**: `src/routes/planner/+page.svelte`, `src/routes/+page.svelte`, `src/lib/components/FamilySwitcher.svelte`, `src/lib/stores/members.svelte.ts`

## 20. `overflow-hidden` clips absolutely-positioned dropdowns inside task items

**Symptom**: Dropdown menu renders visually but clicks are intercepted by sibling elements underneath.

**Cause**: Task items use `overflow-hidden` for swipe-reveal functionality. An absolutely-positioned dropdown (`AssignPicker`) rendered inside the task item extends below its bounds and gets clipped. Even with `z-index`, the overflow creates a stacking context boundary.

**Fix**: Dynamically toggle `overflow-visible` and elevate `z-index` on the task item when its dropdown is open.

```svelte
<div class="relative group/task
  {pickerOpen ? 'z-20 overflow-visible' : 'overflow-hidden'}">
```

**Affected file**: `src/lib/components/PlannerDayCard.svelte`
