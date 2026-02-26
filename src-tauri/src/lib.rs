use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

/// Holds the Node.js server child process so we can kill it on app exit.
struct ServerProcess(Mutex<Option<Child>>);

/// Tauri command: kill the Node.js server child process.
/// Called from JS before `relaunch()` so the old server doesn't orphan.
#[tauri::command]
fn kill_server(state: tauri::State<'_, ServerProcess>) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            let _ = child.wait();
            eprintln!("[prosys] killed Node.js server before relaunch");
        }
        *guard = None;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![kill_server])
        .setup(|app| {
            // In dev mode, Tauri's beforeDevCommand starts the Vite server
            // and the window loads devUrl automatically — nothing to do here.
            if cfg!(debug_assertions) {
                return Ok(());
            }

            // ── Production: spawn the Node.js server ─────────────────────

            // Locate the Node.js binary (GUI apps don't inherit the user's
            // shell PATH, so we search common installation locations).
            let node_path = find_node().ok_or_else(|| {
                "Node.js not found. Please install Node.js (https://nodejs.org) \
                 and make sure it is available at one of the standard paths \
                 (/opt/homebrew/bin/node, /usr/local/bin/node, ~/.nvm, ~/.volta, etc.)."
                    .to_string()
            })?;

            // Bundled server files live inside the app's resource directory
            // (Contents/Resources/ on macOS).
            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to resolve resource directory: {e}"))?;

            let server_dir = resource_dir.join("server");
            let server_js = server_dir.join("server.js");

            if !server_js.exists() {
                return Err(format!(
                    "Server entry point not found at {}. \
                     The app bundle may be incomplete.",
                    server_js.display()
                )
                .into());
            }

            // Store the database in a persistent location outside the app
            // bundle so data survives app updates and rebuilds.
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

            // If an old Node.js server is still running on port 3000
            // (e.g., orphaned after update-and-relaunch), wait for it to die.
            // JS calls kill_server before relaunch, but this handles the first
            // upgrade to this version (where kill_server didn't exist yet).
            let port_was_free = wait_for_port_free("localhost:3000", 25, 200);
            if !port_was_free {
                eprintln!(
                    "[prosys] Warning: port 3000 still occupied after 5s — spawning anyway"
                );
            }

            let child = Command::new(&node_path)
                .arg(&server_js)
                .env("PORT", "3000")
                .env("HOST", "0.0.0.0")
                .env("PROSYS_DATA_DIR", &data_dir)
                .current_dir(&server_dir)
                .spawn()
                .map_err(|e| {
                    format!(
                        "Failed to start Node.js server ({}):\n{e}",
                        node_path.display()
                    )
                })?;

            app.manage(ServerProcess(Mutex::new(Some(child))));

            // Poll until the server is ready (max ~10 seconds)
            let ready = wait_for_server("http://localhost:3000", 50, 200);
            if !ready {
                eprintln!("Warning: Node.js server did not become ready in time");
            }

            // ── Version-based cache clearing ─────────────────────────
            // WKWebView persists its HTTP disk cache and service worker
            // registrations across app reinstalls.  On version upgrades
            // we must clear them so the new build's assets load fresh.
            //
            // Strategy (belt-and-suspenders):
            //  1. Filesystem: delete ~/Library/Caches/{id}/ which holds the
            //     WKWebView HTTP disk cache.  This is safe — IndexedDB
            //     (offline mutation queue) lives in ~/Library/WebKit/ and
            //     the SQLite database lives in PROSYS_DATA_DIR.
            //  2. JS eval: clear SW registrations + CacheStorage API from
            //     inside the WebView (covers in-memory / non-disk caches).

            let current_version = app.package_info().version.to_string();
            let version_file = data_dir.join("app-version.txt");
            let last_version = fs::read_to_string(&version_file)
                .unwrap_or_default()
                .trim()
                .to_string();

            let is_upgrade =
                !last_version.is_empty() && last_version != current_version;

            if is_upgrade {
                // ── Step 1: nuke the WKWebView HTTP disk cache ──────────
                if let Ok(home) = std::env::var("HOME") {
                    let identifier = app.config().identifier.as_str();
                    let cache_dir =
                        PathBuf::from(&home).join("Library/Caches").join(identifier);
                    if cache_dir.exists() {
                        match fs::remove_dir_all(&cache_dir) {
                            Ok(_) => eprintln!(
                                "[prosys] cleared WKWebView HTTP cache at {}",
                                cache_dir.display()
                            ),
                            Err(e) => eprintln!(
                                "[prosys] failed to clear cache at {}: {e}",
                                cache_dir.display()
                            ),
                        }
                    }
                }
            }

            // Navigate the main window to the running server
            if let Some(window) = app.get_webview_window("main") {
                if is_upgrade {
                    // ── Step 2: clear SW + CacheStorage via JS ──────────
                    if let Err(e) = window.eval(
                        r#"(async function() {
                            try {
                                if ('serviceWorker' in navigator) {
                                    var regs = await navigator.serviceWorker.getRegistrations();
                                    await Promise.all(regs.map(function(r) { return r.unregister(); }));
                                }
                                var keys = await caches.keys();
                                await Promise.all(keys.map(function(k) { return caches.delete(k); }));
                            } catch(e) { console.error('[prosys] cache clear failed:', e); }
                            window.location.replace('http://localhost:3000');
                        })();"#,
                    ) {
                        eprintln!("[prosys] cache-clear eval failed: {e}");
                        let _ = window.navigate("http://localhost:3000".parse().unwrap());
                    }
                } else {
                    let _ =
                        window.navigate("http://localhost:3000".parse().unwrap());
                }
            }

            // Persist current version so cache-clear doesn't retrigger.
            // If the old server was still alive during an upgrade (port_was_free
            // was false), skip the write so cache-clear retriggers next launch.
            let _ = fs::create_dir_all(&data_dir);
            if !(is_upgrade && !port_was_free) {
                let _ = fs::write(&version_file, &current_version);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the Node.js server when the window closes
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                        *guard = None;
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Search for the `node` binary in common macOS installation paths.
///
/// macOS GUI apps (launched from Finder / Launchpad) do not inherit the
/// user's shell PATH.  We check well-known locations for Homebrew, nvm,
/// Volta, fnm, and fall back to asking a login shell.
fn find_node() -> Option<PathBuf> {
    // Well-known system-wide locations
    let system_candidates = [
        "/opt/homebrew/bin/node", // Homebrew – Apple Silicon
        "/usr/local/bin/node",    // Homebrew – Intel / manual install
    ];

    for path in &system_candidates {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    // Version-manager shims under $HOME
    if let Ok(home) = std::env::var("HOME") {
        let home_candidates = [
            format!("{home}/.nvm/current/bin/node"),
            format!("{home}/.volta/bin/node"),
            format!("{home}/.fnm/aliases/default/bin/node"),
            format!("{home}/.local/bin/node"),
        ];
        for path in home_candidates {
            let p = PathBuf::from(&path);
            if p.exists() {
                return Some(p);
            }
        }
    }

    // Last resort: ask the user's login shell
    if let Ok(output) = Command::new("/bin/bash")
        .args(["-l", "-c", "which node"])
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    // Also try zsh (common default on macOS)
    if let Ok(output) = Command::new("/bin/zsh")
        .args(["-l", "-c", "which node"])
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

/// Poll `url` up to `max_attempts` times, sleeping `interval_ms` between tries.
/// Returns `true` as soon as a TCP connection succeeds.
fn wait_for_server(url: &str, max_attempts: u32, interval_ms: u64) -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    // Parse host:port from the URL
    let addr = url
        .trim_start_matches("http://")
        .trim_start_matches("https://");

    for _ in 0..max_attempts {
        if TcpStream::connect(addr).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(interval_ms));
    }
    false
}

/// Poll until nothing is listening on `addr`, or timeout.
/// Used after update-and-relaunch to wait for the old server to die.
/// Returns `true` if the port is free, `false` on timeout.
fn wait_for_port_free(addr: &str, max_attempts: u32, interval_ms: u64) -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    for i in 0..max_attempts {
        if TcpStream::connect(addr).is_err() {
            if i > 0 {
                eprintln!("[prosys] port {addr} became free after {i} attempts");
            }
            return true;
        }
        std::thread::sleep(Duration::from_millis(interval_ms));
    }
    false
}
