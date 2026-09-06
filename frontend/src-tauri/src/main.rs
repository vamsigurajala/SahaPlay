#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};
use tauri_winrt_notification::Toast;

// Replaces @tauri-apps/plugin-notification's JS sendNotification for the
// Windows desktop build specifically — see the long comment on the
// tauri-winrt-notification dependency in Cargo.toml for why: that plugin's
// own docs say its click/Actions callback only works on mobile, so a toast
// built through it can never tell us it was clicked on Windows at all.
// Toast::on_activated below fires for a plain body click too (not just an
// explicit button), which is exactly what "bring the window forward and
// open that chat" needs. `data` is passed through opaquely (not typed
// here) — desktopNotify.js's own two notification shapes (a chat tap
// carrying chatId/type, or a friend-request tap carrying type/username)
// both just need to come back out exactly as they went in, so there's
// nothing for this command to inspect or validate. None for a call
// notification (see desktopNotify.js), which has nowhere specific to
// navigate — GlobalCallOverlay is already always mounted and reactive.
//
// Deliberately fire-and-forget on tauri::async_runtime::spawn, mirroring
// exactly how tauri-plugin-notification's OWN Windows backend calls the
// underlying WinRT toast API (it goes through notify-rust, which internally
// calls this exact same tauri-winrt-notification crate — confirmed by
// reading its source — always from inside an async_runtime::spawn'd task,
// never a plain synchronous call). A first version of this command called
// Toast::show() directly and synchronously from the command handler itself,
// which stopped notifications from appearing at all — Windows' WinRT toast
// APIs are COM calls that need the calling thread's COM apartment already
// initialized, which the async runtime's worker threads apparently have and
// a synchronous command-dispatch thread apparently doesn't. Matching the
// proven-working call site exactly, rather than guessing further, is the
// fix.
#[tauri::command]
fn show_windows_toast(app: tauri::AppHandle, title: String, body: String, data: Option<serde_json::Value>) {
    tauri::async_runtime::spawn(async move {
        let result = Toast::new("com.sahaplay.desktop")
            .title(&title)
            .text1(&body)
            .on_activated(move |_action| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                if let Some(data) = data.clone() {
                    // Rebroadcast into the same 'open_chat_from_notification'
                    // browser CustomEvent the native Android app's own
                    // notification tap already produces — see
                    // desktopNotify.js's registerTauriEventBridge, which
                    // forwards this Tauri event into that exact DOM event so
                    // Navbar.jsx/Room.jsx need no Tauri-specific code of
                    // their own to react to it.
                    let _ = app.emit("open_chat_from_notification", data);
                }
                Ok(())
            })
            .show();
        if let Err(err) = result {
            eprintln!("[show_windows_toast] Toast::show failed: {err:?}");
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
        // The plain Web `Notification` API doesn't reliably surface as a real
        // Windows toast from an unpackaged WebView2 host (no registered AUMID)
        // — confirmed by testing, not just a theoretical risk. This plugin
        // talks to the native Windows notification system directly, the same
        // way Tauri apps are documented to do it. See desktopNotify.js, which
        // routes through this plugin specifically when running under Tauri.
        .plugin(tauri_plugin_notification::init())
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
