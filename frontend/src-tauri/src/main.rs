#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

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
        //
        // Desktop notifications themselves (see desktopNotify.js) go
        // through the plain Web `Notification` API now, the same as a
        // regular browser tab — not a Tauri notification plugin/native
        // Rust command. Two earlier native approaches
        // (@tauri-apps/plugin-notification's sendNotification, then a
        // hand-rolled command using tauri-winrt-notification directly for
        // click support that plugin's docs say is mobile-only) were tried
        // and removed after real-device testing kept turning up either no
        // toast at all or no working click, layer after layer of native
        // complexity that never actually fixed it. WebView2 is a real
        // Chromium engine and the app has a proper AUMID via its NSIS
        // install, so the plain API — proven to work for every browser
        // user already — gets to be the one and only path here instead of
        // a fourth native workaround.
        .plugin(tauri_plugin_opener::init())
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
