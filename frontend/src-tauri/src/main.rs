#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_winrt_notification::{IconCrop, Toast};
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryDataAvailable,
    WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest, WINHTTP_ACCESS_TYPE_NO_PROXY,
    WINHTTP_FLAG_SECURE,
};

mod device_assertion;
mod device_unlock;

// Best-effort synchronous HTTPS GET via WinHTTP (TLS handled by the OS's own
// Schannel — see the windows-features comment in Cargo.toml for why this is
// used instead of pulling in a whole HTTP client crate). Only ever called
// with this app's own avatar CDN URLs (never arbitrary user input), so the
// naive "https://" + first "/" split below is safe — no need for a real URL
// parser here.
unsafe fn download_https(url: &str) -> Option<Vec<u8>> {
    let rest = url.strip_prefix("https://")?;
    let (host, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, "/"),
    };
    if host.is_empty() {
        return None;
    }

    let session = WinHttpOpen(&HSTRING::from("SahaPlay-Desktop/1.0"), WINHTTP_ACCESS_TYPE_NO_PROXY, PCWSTR::null(), PCWSTR::null(), 0);
    if session.is_null() {
        return None;
    }
    let connect = WinHttpConnect(session, &HSTRING::from(host), 443, 0);
    if connect.is_null() {
        let _ = WinHttpCloseHandle(session);
        return None;
    }
    let request = WinHttpOpenRequest(
        connect,
        &HSTRING::from("GET"),
        &HSTRING::from(path),
        PCWSTR::null(),
        PCWSTR::null(),
        std::ptr::null(),
        WINHTTP_FLAG_SECURE,
    );
    if request.is_null() {
        let _ = WinHttpCloseHandle(connect);
        let _ = WinHttpCloseHandle(session);
        return None;
    }

    let result = (|| -> windows::core::Result<Vec<u8>> {
        WinHttpSendRequest(request, None, None, 0, 0, 0)?;
        WinHttpReceiveResponse(request, std::ptr::null_mut())?;
        let mut buf = Vec::new();
        loop {
            let mut avail: u32 = 0;
            WinHttpQueryDataAvailable(request, &mut avail)?;
            if avail == 0 {
                break;
            }
            let mut chunk = vec![0u8; avail as usize];
            let mut read: u32 = 0;
            WinHttpReadData(request, chunk.as_mut_ptr() as *mut core::ffi::c_void, avail, &mut read)?;
            chunk.truncate(read as usize);
            if chunk.is_empty() {
                break;
            }
            buf.extend_from_slice(&chunk);
        }
        Ok(buf)
    })();

    let _ = WinHttpCloseHandle(request);
    let _ = WinHttpCloseHandle(connect);
    let _ = WinHttpCloseHandle(session);

    match result {
        Ok(bytes) if !bytes.is_empty() => Some(bytes),
        _ => None,
    }
}

// Sniffs the actual image format from its magic bytes rather than trusting
// the source URL's extension (this app's avatar CDN URLs aren't guaranteed
// to carry one) — the toast image file needs a real, matching extension for
// Windows to decode it.
fn sniff_image_ext(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "webp"
    } else if bytes.starts_with(b"GIF8") {
        "gif"
    } else {
        "png"
    }
}

// Downloads a sender's avatar and caches it locally under a filename keyed
// by `tag` (the same per-conversation tag show_windows_toast already uses,
// e.g. the partner/room id) — so a second notification from the same
// conversation just overwrites the same file instead of accumulating one
// file per notification forever, and naturally picks up a changed avatar on
// the next message. WinRT toast images require a local file (see
// tauri-winrt-notification's `icon()`, which always wraps the path in
// `file:///`) — a remote URL can't be used directly here.
fn cache_avatar_icon(app: &AppHandle, tag: &str, url: &str) -> Option<std::path::PathBuf> {
    let bytes = unsafe { download_https(url) }?;
    let ext = sniff_image_ext(&bytes);
    let dir = app.path().app_cache_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    let safe_tag: String = tag.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let path = dir.join(format!("notif_avatar_{safe_tag}.{ext}"));
    std::fs::write(&path, &bytes).ok()?;
    Some(path)
}

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
fn show_windows_toast(app: AppHandle, title: String, body: String, tag: String, launch_data: Option<String>, icon_url: Option<String>) {
    let identifier = app.config().identifier.clone();
    let result_handle = app.clone();
    let log_handle = app.clone();
    let activate_handle = app.clone();
    let icon_handle = app.clone();
    let icon_tag = tag.clone();

    tauri::async_runtime::spawn(async move {
        // Best-effort: a failed/slow download just means the toast falls
        // back to no per-message icon (the app's own default icon is still
        // shown by Windows) rather than delaying or failing the toast.
        let icon_path = icon_url.and_then(|u| cache_avatar_icon(&icon_handle, &icon_tag, &u));

        let mut toast = Toast::new(&identifier)
            .title(&title)
            .text1(&body);
        if let Some(path) = icon_path.as_deref() {
            toast = toast.icon(path, IconCrop::Circular, "avatar");
        }
        let toast = toast
            .on_activated(move |_arg| {
                if let Some(window) = activate_handle.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                // Same "the user just reopened" signal the tray "open" item
                // and the single-instance relaunch handler below already
                // emit on their own reopen paths — this was the missing
                // third one. Without it, clicking a notification while the
                // window was hidden (CloseRequested's handler below never
                // actually quits the app, only hides it — see its own
                // comment) skipped CryptoContext.jsx's strict-mode re-check
                // entirely: the window came back on screen, but nothing
                // ever re-ran Windows Hello or re-derived the key, so a
                // strict-mode account sat on an already-cleared keyPair
                // (cleared by "desktop_window_hidden" when it was closed)
                // forever, with no code path left to unstick it. A toast is
                // never shown while the window is already on-screen (see
                // desktopNotify.js's isTauriWindowActuallyOnScreen check), so
                // this always corresponds to a genuine reopen here, never a
                // spurious re-prompt while the user is already in the app.
                let _ = activate_handle.emit("desktop_window_shown", ());
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
                // See the "desktop_window_shown" comment on the tray "open"
                // handler below — same explicit reopen signal, this is just
                // the other place a reopen can originate from (relaunching
                // the .exe/shortcut while already running in the tray,
                // rather than the tray menu itself).
                let _ = app.emit("desktop_window_shown", ());
            }
        }))
        // Lets the app open ms-settings:notifications directly — used when
        // the OS-level notification toggle for SahaPlay is off, so "fix it
        // for me" from inside our own Settings screen actually takes the
        // user to the one place that can fix it (the app itself can't grant
        // its own OS notification permission, only Windows' own Settings UI
        // can flip that toggle).
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            show_windows_toast,
            device_unlock::windows_device_unlock_has,
            device_unlock::windows_device_unlock_setup,
            device_unlock::windows_device_unlock_unlock,
            device_unlock::windows_device_unlock_clear,
        ])
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
                            // Explicit "the user just reopened from the tray"
                            // signal for CryptoContext.jsx's strict
                            // device-unlock mode. This does NOT fire on
                            // ordinary alt-tab/restore-from-taskbar — those
                            // never touch this code path at all, the window
                            // just stays a normal visible window the whole
                            // time. It only fires here and in the
                            // single-instance handler above, i.e. only when
                            // the window was actually hidden (via the
                            // CloseRequested handler below) and is now being
                            // explicitly re-shown — exactly the "closed,
                            // then reopened" transition strict mode cares
                            // about, never a mere focus change.
                            let _ = app.emit("desktop_window_shown", ());
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
                // "The app was closed" signal for strict device-unlock mode
                // — see device_unlock.rs's module doc for the full design.
                // Rust deliberately has no opinion here on whether strict
                // mode is even on (that setting lives in JS/localStorage,
                // same as isStrictDeviceUnlockEnabled() on Android); this
                // just reports the one fact only Rust can see (the window
                // was actually closed, not merely unfocused), and lets
                // CryptoContext.jsx decide what to do with it — same
                // separation of concerns as every other native/JS boundary
                // in this app.
                let _ = window.emit("desktop_window_hidden", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running SahaPlay desktop application");
}
