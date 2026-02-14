use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

/// Holds the Node.js server child process so we can kill it on app exit.
struct ServerProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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

            // Navigate the main window to the running server
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.navigate("http://localhost:3000".parse().unwrap());
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
        "/usr/local/bin/node",   // Homebrew – Intel / manual install
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
