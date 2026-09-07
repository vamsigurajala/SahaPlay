#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_winrt_notification::Toast;

// Appends one line to <app log dir>/notify-debug.log — a diagnostic channel
// that survives even if the JS side never sees the desktop_toast_result
// event (e.g. IPC/event-bridge issue) or no react-hot-toast <Toaster/> is
// mounted on whatever page is active. If a real toast still isn't showing
// up after this build, this file
// (%LOCALAPPDATA%\com.sahaplay.desktop\logs\notify-debug.log) is the thing
// to read/share — it will say plainly whether Toast::show() itself
// succeeded or exactly why it didn't.
fn log_toast_attempt(app: &AppHandle, line: &str) {
    let dir = match app.path().app_log_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let _ = std::fs::create_dir_all(&dir);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("notify-debug.log")) {
        let _ = writeln!(f, "[{now}] {line}");
    }
}

// Builds and shows a real Windows toast natively in Rust, bypassing the
// WebView entirely. This exists because WebView2 does NOT surface a JS
// `new Notification()` call as a real OS toast — confirmed as a known
// WebView2 limitation (unlike a normal Chrome/Edge browser tab, which
// handles it natively) — so the plain Web Notification API can construct
// the object and report "granted" permission with zero errors while
// literally nothing ever reaches the OS. That's exactly what was happening:
// the app's notification sound (a plain <audio> element, unrelated to this
// API) played fine while no toast ever appeared.
//
// Deliberately as close as possible to what @tauri-apps/plugin-notification
// itself does under the hood (same tauri-winrt-notification crate, same
// app_id = the Tauri `identifier`, same tauri::async_runtime::spawn wrapping)
// — that exact combination was confirmed to display a real toast on this
// app before (see git history), the only problem with it being that its
// Actions API for click-to-open is mobile-only. Click support is out of
// scope for now; this only needs to get a toast on screen at all. No
// on_activated handler is registered — one extra difference from the
// proven-working path was one too many variables while debugging "nothing
// shows up at all."
//
// Both outcomes are reported back over two independent channels so a
// failure (or even a same-page mismatch — Rust says it showed, Windows
// still didn't display it) is never silently invisible again: the
// desktop_toast_result JS event (see desktopNotify.js, shown as an
// on-screen banner that doesn't depend on any React component being
// mounted) and notify-debug.log on disk as a backstop if even that event
// never reaches JS.
#[tauri::command]
fn show_windows_toast(app: AppHandle, title: String, body: String, tag: String) {
    let identifier = app.config().identifier.clone();
    let result_handle = app.clone();
    let log_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let toast = Toast::new(&identifier).title(&title).text1(&body);

        match toast.show() {
            Ok(()) => {
                log_toast_attempt(&log_handle, &format!("OK tag={tag} app_id={identifier}"));
                let _ = result_handle.emit(
                    "desktop_toast_result",
                    serde_json::json!({ "tag": tag, "ok": true }),
                );
            }
            Err(e) => {
                log_toast_attempt(&log_handle, &format!("ERR tag={tag} app_id={identifier} error={e}"));
                let _ = result_handle.emit(
                    "desktop_toast_result",
                    serde_json::json!({ "tag": tag, "ok": false, "error": e.to_string() }),
                );
            }
        }
    });
}

fn main() {
    tauri::Builder::default()
        // Relaunching the .exe while an instance is already running (e.g.
        // double-clicking a desktop shortcut again while it's hidden in the
        // tray) focuses the existing window instead of opening a second one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // Lets the app open ms-settings:notifications directly — used when
        // the OS-level notification toggle for SahaPlay is off, so "fix it
        // for me" from inside our own Settings screen actually takes the
        // user to the one place that can fix it (the app itself can't grant
        // its own OS notification permission, only Windows' own Settings UI
        // can flip that toggle).
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![show_windows_toast])
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "open", "Open SahaPlay", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // Closing the window hides it instead of destroying it — this is
        // what keeps the existing JS app (socket connection, CallContext,
        // everything) running completely unchanged in the background,
        // same as how Discord/Slack's desktop apps behave. Only the tray
        // menu's "Quit" above actually terminates the app (app.exit(0)).
        // Unlike Android, Windows doesn't kill a hidden window's process —
        // nothing else needs to change for calls/notifications to keep
        // working while minimized to tray.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running SahaPlay desktop application");
}
