#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_winrt_notification::Toast;

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
// An earlier attempt at this exact approach (see git history) also failed
// to display anything, but critically never checked the Result of
// `Toast::show()` — so a silent Err (wrong app_id, COM/apartment issue,
// anything) would have looked identical to "nothing happened," same as
// what was being debugged. This version reports success/failure back to JS
// via the desktop_toast_result event specifically so that stops being a
// guessing game.
//
// app_id is the Tauri `identifier` from tauri.conf.json
// (com.sahaplay.desktop) — Tauri's NSIS bundler registers this exact
// string as the installed shortcut's AppUserModelID via the NSIS
// ApplicationID plugin, which is what lets CreateToastNotifierWithId(app_id)
// resolve to a real, correctly-attributed notifier instead of being
// silently dropped by the OS for an unrecognized id.
#[tauri::command]
fn show_windows_toast(app: AppHandle, title: String, body: String, tag: String, launch_data: Option<String>) {
    let identifier = app.config().identifier.clone();
    let activate_handle = app.clone();
    let result_handle = app.clone();

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
                let _ = result_handle.emit(
                    "desktop_toast_result",
                    serde_json::json!({ "tag": tag, "ok": true }),
                );
            }
            Err(e) => {
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
