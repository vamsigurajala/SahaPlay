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
// Click-to-open goes through on_activated directly rather than
// @tauri-apps/plugin-notification's Actions API — that API is documented as
// mobile-only, confirmed by the plugin's own open GitHub issue for exactly
// this ("Notification onclick event" is still a feature request there).
// on_activated fires for a plain body click too, not just toast buttons: the
// event handler is registered on the live ToastNotification COM object
// itself, which WinRT/COM reference-counting keeps alive independently of
// this async fn's own scope once handed to the OS, so it still fires
// whenever the user actually clicks, however much later that is.
// launch_data (the same { chatId, type } / { type, username } shape
// dispatchChatOpenFromNotification in desktopNotify.js already knows how to
// route) is captured directly by the closure rather than round-tripped
// through the toast itself — this crate has no .launch()/argument builder,
// so there's nothing for Windows to hand back on activation; the closure
// already has what it needs.
#[tauri::command]
fn show_windows_toast(app: AppHandle, title: String, body: String, tag: String, launch_data: Option<String>) {
    let identifier = app.config().identifier.clone();
    let result_handle = app.clone();
    let log_handle = app.clone();
    let activate_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let toast = Toast::new(&identifier)
            .title(&title)
            .text1(&body)
            .on_activated(move |_arg| {
                if let Some(window) = activate_handle.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = activate_handle.emit("desktop_toast_clicked", launch_data.clone());
                Ok(())
            });

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
