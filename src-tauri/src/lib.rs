use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

/// Holds the Node.js server child process so we can kill it on app exit.
struct ServerProcess(Mutex<Option<Child>>);

/// Tauri command: show the main window.
/// Called from the SvelteKit frontend after hydration so the user never
/// sees a blank page or "file not found" flash during startup.
#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }
}

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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![show_main_window, kill_server])
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

            // Pick a free port so we never conflict with other apps on
            // the user's machine (port 3000 is extremely common for dev).
            let port = find_or_reuse_port(&data_dir);
            let port_str = port.to_string();
            let server_url = format!("http://localhost:{port}");

            eprintln!("[prosys] starting Node.js server on port {port}");

            let child = Command::new(&node_path)
                .arg(&server_js)
                .env("PORT", &port_str)
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
            let ready = wait_for_server(&server_url, 50, 200);
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
                // WKWebView may use either the bundle identifier or the
                // productName (lowercased) for its cache directory — clear both.
                if let Ok(home) = std::env::var("HOME") {
                    let identifier = app.config().identifier.clone();
                    let product_name = app
                        .config()
                        .product_name
                        .as_deref()
                        .unwrap_or("prosys")
                        .to_lowercase();

                    let caches_base = PathBuf::from(&home).join("Library/Caches");

                    for dir_name in [identifier.as_str(), product_name.as_str()] {
                        let cache_dir = caches_base.join(dir_name);
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
            }

            // Navigate the main window to the running server
            let nav_url: tauri::Url = server_url.parse().unwrap();
            if let Some(window) = app.get_webview_window("main") {
                if is_upgrade {
                    // ── Step 2: clear SW + CacheStorage via JS ──────────
                    let js = format!(
                        r#"(async function() {{
                            try {{
                                if ('serviceWorker' in navigator) {{
                                    var regs = await navigator.serviceWorker.getRegistrations();
                                    await Promise.all(regs.map(function(r) {{ return r.unregister(); }}));
                                }}
                                var keys = await caches.keys();
                                await Promise.all(keys.map(function(k) {{ return caches.delete(k); }}));
                            }} catch(e) {{ console.error('[prosys] cache clear failed:', e); }}
                            window.location.replace('{server_url}');
                        }})();"#
                    );
                    if let Err(e) = window.eval(&js) {
                        eprintln!("[prosys] cache-clear eval failed: {e}");
                        let _ = window.navigate(nav_url.clone());
                    }
                } else {
                    let _ = window.navigate(nav_url);
                }
            }

            // Persist current version so cache-clear doesn't retrigger.
            let _ = fs::create_dir_all(&data_dir);
            let _ = fs::write(&version_file, &current_version);

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

/// Pick a stable port for the Node.js server.
///
/// Reuses the port from a previous launch (saved in `server-port.txt`)
/// if it's still available. Otherwise picks a new free port from the OS
/// and persists it for next time. This keeps PWA client URLs stable
/// across app restarts while avoiding conflicts with other software.
fn find_or_reuse_port(data_dir: &std::path::Path) -> u16 {
    use std::net::TcpListener;

    let port_file = data_dir.join("server-port.txt");

    // Try to reuse the previously saved port
    if let Ok(contents) = fs::read_to_string(&port_file) {
        if let Ok(saved_port) = contents.trim().parse::<u16>() {
            if let Ok(listener) = TcpListener::bind(("127.0.0.1", saved_port)) {
                drop(listener);
                return saved_port;
            }
            eprintln!("[prosys] saved port {saved_port} is occupied, picking a new one");
        }
    }

    // Pick a new free port
    let port = TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(3000);

    // Persist for next launch
    let _ = fs::create_dir_all(data_dir);
    let _ = fs::write(&port_file, port.to_string());

    port
}
