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

            // ── Production: spawn the Node.js server as a sidecar ────────

            // Resolve the path to server.js relative to the app's resource dir.
            // When bundled, the executable lives inside the .app bundle, so we
            // navigate up to the project root where server.js is located.
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                .unwrap_or_default();

            // In a macOS .app bundle the binary is at:
            //   ProSys.app/Contents/MacOS/ProSys
            // server.js and build/ sit next to the .app, so go up 3 levels.
            // During development (cargo run), the binary is in target/debug/,
            // and server.js is at the workspace root (2 levels up).
            let project_root = if exe_dir.ends_with("Contents/MacOS") {
                exe_dir
                    .parent()
                    .and_then(|p| p.parent())
                    .and_then(|p| p.parent())
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| exe_dir.clone())
            } else {
                exe_dir
                    .parent()
                    .and_then(|p| p.parent())
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| exe_dir.clone())
            };

            let server_js = project_root.join("server.js");

            let child = Command::new("node")
                .arg(&server_js)
                .env("PORT", "3000")
                .env("HOST", "0.0.0.0")
                .current_dir(&project_root)
                .spawn()
                .expect("Failed to start Node.js server — is `node` on PATH?");

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
