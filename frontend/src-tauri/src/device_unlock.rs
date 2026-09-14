// device_unlock.rs
//
// Windows E2EE "device unlock" — Design A from the feasibility investigation,
// confirmed against a real device before this was written (see the POC run:
// three separate IUserConsentVerifierInterop::RequestVerificationForWindowAsync
// calls, two back-to-back and one 60s later, each produced a genuinely fresh
// Windows Hello prompt — no caching, no grace period).
//
// Architecture, deliberately mirroring the Android implementation
// (E2eeKeyStore.java / SahaplayE2eePlugin.java / DeviceAssertionVerifier.java)
// piece for piece, same reasoning, same guarantees:
//   - DPAPI (CryptProtectData/CryptUnprotectData, CURRENT_USER scope, no
//     extra entropy) wraps the account's existing 32-byte E2EE secret key at
//     rest — the Windows analog of AndroidKeyStore's AES key. This alone
//     (no Windows Hello involved) is what makes the lenient/default mode
//     work: silent, no UI, persists indefinitely, gated only by "still the
//     same logged-in Windows user."
//   - UserConsentVerifier (via its IUserConsentVerifierInterop Win32 interop
//     — NOT KeyCredentialManager/RequestSignAsync, which the investigation
//     found unsupported outside UWP) is a GATE checked before DPAPI-unwrap
//     when strict mode is on — the Windows analog of BiometricPrompt. It
//     has NO cryptographic relationship to the wrapped secret itself: losing
//     or resetting Windows Hello never breaks the DPAPI blob, only the gate
//     temporarily can't be satisfied (falls back to passphrase, same as
//     Android's KeyPermanentlyInvalidatedException handling — never a
//     reason to regenerate the E2EE keypair).
//   - device_assertion.rs closes the same cross-account-leak gap
//     DeviceAssertionVerifier.java closes on Android: accountId is supplied
//     by JS and is NEVER, by itself, sufficient authorization — every
//     command here requires a FRESH, signature-verified assertion whose OWN
//     decoded id matches the caller's claim, or the outcome is
//     indistinguishable from "nothing enrolled here."
//
// Storage: one file per account under <app data dir>/device_unlock/<id>.bin
// — same per-account keying rationale as Android's `sahaplay_e2ee_key_<id>`
// alias (two SahaPlay accounts on the same Windows profile must never be
// able to reach each other's wrapper).

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};
use windows::core::HSTRING;
use windows::Foundation::IAsyncOperation;
use windows::Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier};
use windows::Win32::Foundation::{HWND, LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};
use windows::Win32::System::WinRT::IUserConsentVerifierInterop;

use crate::device_assertion;

// Persistent, step-by-step diagnostic log — the same "open, append one
// line, close" pattern as main.rs's log_toast_attempt, chosen for the same
// reason: it survives even if the process later hangs or is killed, unlike
// an in-memory log or a WebView console.log the user has no way to see
// once the window stops responding. Lives at
// %LOCALAPPDATA%\com.sahaplay.desktop\logs\device-unlock-debug.log — this
// is the file to read after reproducing any device-unlock issue on
// Windows, same role notify-debug.log plays for toast issues.
fn log_line(app: &AppHandle, line: &str) {
    let dir = match app.path().app_log_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let _ = fs::create_dir_all(&dir);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(dir.join("device-unlock-debug.log")) {
        let _ = writeln!(f, "[{now}] {line}");
    }
}

#[derive(Debug, Serialize)]
pub struct DeviceUnlockError {
    pub code: &'static str,
    pub message: String,
}

impl DeviceUnlockError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

// Tauri serializes a returned Err(T: Serialize) straight to the JS-side
// rejection — deviceUnlock.js's Tauri branch reads `.code`/`.message` off
// it, matching the exact shape nativeErrorToDeviceUnlockError already
// expects from the Android side, so no new JS-side error vocabulary is
// needed.
type CmdResult<T> = Result<T, DeviceUnlockError>;

fn blob_dir(app: &AppHandle) -> CmdResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not resolve app data dir: {e}")))?;
    Ok(base.join("device_unlock"))
}

fn blob_path(app: &AppHandle, account_id: i64) -> CmdResult<PathBuf> {
    Ok(blob_dir(app)?.join(format!("{account_id}.bin")))
}

/// Verifies a REQUIRED, freshly-supplied assertion against account_id.
/// Returns the verified payload, or a DeviceUnlockError identical to
/// "nothing enrolled here" on ANY failure — no DPAPI/Hello work is ever
/// attempted first. Mirrors SahaplayE2eePlugin.java's verifyFreshAssertion
/// exactly, including its own comment on why: accountId is purely a
/// cross-check value, never a source of trust on its own.
fn verify_fresh_assertion(account_id: i64, assertion: &str) -> CmdResult<device_assertion::AssertionPayload> {
    match device_assertion::verify(assertion) {
        Some(payload) if payload.id == account_id => Ok(payload),
        _ => Err(DeviceUnlockError::new(
            "NO_VALID_ASSERTION",
            "No valid device-unlock assertion for this account",
        )),
    }
}

// ─── DPAPI ──────────────────────────────────────────────────────────────
fn dpapi_protect(data: &[u8]) -> CmdResult<Vec<u8>> {
    unsafe {
        let mut input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB::default();
        CryptProtectData(
            &mut input,
            &HSTRING::from("SahaPlay E2EE device unlock"),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("CryptProtectData failed: {e}")))?;

        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        if !output.pbData.is_null() {
            let _ = LocalFree(HLOCAL(output.pbData as *mut _));
        }
        Ok(result)
    }
}

fn dpapi_unprotect(data: &[u8]) -> CmdResult<Vec<u8>> {
    unsafe {
        let mut input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB::default();
        // CRYPTPROTECT_UI_FORBIDDEN here too — DPAPI itself must NEVER show
        // its own UI; the only UI in this whole feature is the explicit
        // UserConsentVerifier gate below, shown only when strict mode asks
        // for it.
        CryptUnprotectData(&mut input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output).map_err(|e| {
            // A DPAPI failure here means "can't recover this wrapper as this
            // Windows user, right now" — could be a genuinely corrupt blob,
            // or the Windows account's own master key having changed
            // (profile reset, password reset via certain recovery paths).
            // Treated uniformly, same as Android's CorruptDeviceWrapperException:
            // discard and fall back to passphrase, never regenerate a keypair.
            DeviceUnlockError::new("CORRUPT_WRAPPER", format!("CryptUnprotectData failed: {e}"))
        })?;

        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        if !output.pbData.is_null() {
            let _ = LocalFree(HLOCAL(output.pbData as *mut _));
        }
        Ok(result)
    }
}

// ─── Windows Hello gate (UserConsentVerifier) ──────────────────────────
fn request_hello_verification(hwnd: HWND, message: &str) -> CmdResult<UserConsentVerificationResult> {
    let factory: IUserConsentVerifierInterop = windows::core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>()
        .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not access Windows Hello: {e}")))?;

    let hstr_message = HSTRING::from(message);
    let op: IAsyncOperation<UserConsentVerificationResult> = unsafe {
        factory
            .RequestVerificationForWindowAsync(hwnd, &hstr_message)
            .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Windows Hello request failed: {e}")))?
    };
    op.get().map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Windows Hello await failed: {e}")))
}

// Wraps request_hello_verification with the two things it needs to not
// freeze the whole app:
//
// 1. Runs the actual blocking WinRT `.get()` wait on its OWN dedicated
//    thread, never the caller's thread. This matters because Tauri's IPC
//    bridge (WebView2's message channel) invokes a plain (non-async)
//    `#[tauri::command]` function INLINE, synchronously, on the thread
//    that owns the WebView2/window — i.e. the main UI thread — confirmed
//    directly against tauri-macros' generated dispatch code
//    (`body_blocking` calls the command function directly, no
//    spawn_blocking). `IAsyncOperation::get()` is a raw blocking wait with
//    no nested message pump, so calling it there starves the very message
//    queue Windows needs to pump in order to show/activate the Windows
//    Hello consent dialog against our window at all — this is what
//    produced the reported symptom exactly: the whole window going
//    "(Not Responding)" with Windows Hello never appearing, after
//    enabling strict mode and reopening from the tray. The real fix is
//    making the calling commands `async fn` (see below) so Tauri never
//    runs them inline on that thread in the first place, PLUS isolating
//    this specific wait on its own thread as defense in depth regardless
//    of which thread ends up calling this function.
// 2. A hard timeout on the receiving side, so a future issue here becomes
//    a typed AUTH_FAILED error (which the JS side already know how to
//    fall back to passphrase on) instead of an indefinite hang.
fn request_hello_verification_with_timeout(app: &AppHandle, hwnd: HWND, message: &'static str) -> CmdResult<UserConsentVerificationResult> {
    let (tx, rx) = mpsc::channel::<CmdResult<UserConsentVerificationResult>>();
    // HWND wraps a raw pointer and isn't Send — move its bit pattern across
    // the thread boundary and rebuild the HWND from it on the worker
    // thread. The window itself still belongs to the main thread; this
    // worker thread only ever reads that handle value, it never touches
    // the window directly, so no ownership requirement is violated.
    let hwnd_addr = hwnd.0 as usize;
    // AppHandle is cheap to clone and Send — used here purely so the
    // worker thread can append its own progress lines to the same log.
    let log_app = app.clone();

    log_line(app, &format!("hello: starting on a dedicated worker thread (\"{message}\")"));
    thread::spawn(move || {
        log_line(&log_app, "hello: worker thread started, calling request_hello_verification");
        let result = request_hello_verification(HWND(hwnd_addr as *mut _), message);
        log_line(&log_app, &format!("hello: request_hello_verification returned {result:?}"));
        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(result) => result,
        Err(_) => {
            log_line(app, "hello: TIMED OUT waiting 30s for worker thread — no Windows Hello prompt completed in time");
            Err(DeviceUnlockError::new("AUTH_FAILED", "Windows Hello did not respond in time"))
        }
    }
}

/// Maps a Windows Hello outcome to the shared DeviceUnlockError vocabulary.
/// Ok(()) means Verified — proceed to DPAPI unwrap. Every other outcome is
/// a typed rejection; NONE of them are ever grounds to touch the DPAPI
/// blob or regenerate an E2EE keypair.
fn require_verified(result: UserConsentVerificationResult) -> CmdResult<()> {
    // windows-rs generates WinRT enums (like this one) as newtype structs
    // with associated const values, NOT real Rust enums — so `use X::*` and
    // bare-identifier match arms don't do what they look like they do (each
    // arm silently becomes a fresh irrefutable binding, which is exactly
    // why the compiler flagged every arm after the first as unreachable).
    // Compare by value instead.
    if result == UserConsentVerificationResult::Verified {
        return Ok(());
    }
    if result == UserConsentVerificationResult::Canceled {
        return Err(DeviceUnlockError::new("AUTH_FAILED", "Windows Hello verification was canceled"));
    }
    if result == UserConsentVerificationResult::RetriesExhausted {
        return Err(DeviceUnlockError::new("AUTH_FAILED", "Too many failed Windows Hello attempts"));
    }
    if result == UserConsentVerificationResult::NotConfiguredForUser {
        return Err(DeviceUnlockError::new(
            "NOT_CONFIGURED",
            "Windows Hello is not set up for this Windows account",
        ));
    }
    if result == UserConsentVerificationResult::DisabledByPolicy {
        return Err(DeviceUnlockError::new("NOT_CONFIGURED", "Windows Hello is disabled by policy"));
    }
    if result == UserConsentVerificationResult::DeviceNotPresent {
        return Err(DeviceUnlockError::new("HARDWARE_UNAVAILABLE", "No Windows Hello hardware present"));
    }
    if result == UserConsentVerificationResult::DeviceBusy {
        return Err(DeviceUnlockError::new("HARDWARE_UNAVAILABLE", "Windows Hello device is busy"));
    }
    Err(DeviceUnlockError::new("AUTH_FAILED", "Windows Hello verification did not succeed"))
}

fn main_hwnd(window: &WebviewWindow) -> CmdResult<HWND> {
    window
        .hwnd()
        .map(|h| HWND(h.0))
        .map_err(|e| DeviceUnlockError::new("NATIVE_UNAVAILABLE", format!("Could not get window handle: {e}")))
}

// ─── Tauri commands — mirror SahaplayE2eePlugin.java's public surface ──

#[tauri::command]
pub fn windows_device_unlock_has(app: AppHandle, account_id: i64, assertion: String) -> CmdResult<bool> {
    verify_fresh_assertion(account_id, &assertion)?;
    Ok(blob_path(&app, account_id)?.exists())
}

// `async fn` here is load-bearing, not decorative: it changes which
// Tauri-generated dispatch path handles this command
// (`respond_async_serialized`, which spawns the body onto the async
// runtime) instead of calling it inline on the WebView2 IPC/main thread —
// see request_hello_verification_with_timeout's comment for why that
// distinction is exactly what fixes the app-freeze bug. The body itself
// has no `.await` points; that's fine, an async fn doesn't require any.
#[tauri::command]
pub async fn windows_device_unlock_setup(
    app: AppHandle,
    window: WebviewWindow,
    account_id: i64,
    assertion: String,
    secret_key_base64: String,
    allow_overwrite: bool,
    strict: bool,
) -> CmdResult<()> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    log_line(&app, &format!("setup: called (account_id={account_id}, strict={strict}, allow_overwrite={allow_overwrite})"));

    verify_fresh_assertion(account_id, &assertion)?;
    log_line(&app, "setup: assertion verified");

    let path = blob_path(&app, account_id)?;
    if !allow_overwrite && path.exists() {
        log_line(&app, "setup: rejected — already enrolled and allow_overwrite=false");
        return Err(DeviceUnlockError::new(
            "ALREADY_ENROLLED",
            "Device unlock already enrolled for this account — pass allowOverwrite from an explicit re-enrollment flow to replace it.",
        ));
    }

    let secret_key_bytes = STANDARD
        .decode(secret_key_base64)
        .map_err(|_| DeviceUnlockError::new("INVALID_REQUEST", "secretKeyBase64 is not valid base64"))?;
    if secret_key_bytes.len() != 32 {
        return Err(DeviceUnlockError::new("INVALID_REQUEST", "secretKeyBase64 must decode to exactly 32 bytes"));
    }

    // Strict enrollment gets an explicit Windows Hello confirmation before
    // wrapping — mirrors Android's setupDeviceUnlock, where the freshly
    // generated auth-required key's first use typically already forces a
    // BiometricPrompt. DPAPI has no such requirement on its own, so this is
    // done deliberately: strict mode's whole point is "prove it's you" —
    // enrollment should ask that too, not just every unlock afterward.
    if strict {
        let hwnd = main_hwnd(&window)?;
        log_line(&app, "setup: strict — requesting Windows Hello");
        let result = request_hello_verification_with_timeout(&app, hwnd, "Confirm to enable Device Unlock")?;
        log_line(&app, &format!("setup: Windows Hello result = {result:?}"));
        require_verified(result)?;
    }

    let wrapped = dpapi_protect(&secret_key_bytes)?;
    log_line(&app, "setup: DPAPI-wrapped secret");

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not create device_unlock dir: {e}")))?;
    }
    fs::write(&path, &wrapped).map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not write wrapper: {e}")))?;

    log_line(&app, "setup: done, wrapper written");
    Ok(())
}

// async fn for the same reason as windows_device_unlock_setup above — this
// is the command that fires from CryptoContext.jsx's desktop_window_shown
// listener on every strict-mode tray reopen, i.e. exactly the codepath
// that was freezing the app.
#[tauri::command]
pub async fn windows_device_unlock_unlock(
    app: AppHandle,
    window: WebviewWindow,
    account_id: i64,
    assertion: String,
    strict: bool,
) -> CmdResult<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    log_line(&app, &format!("unlock: called (account_id={account_id}, strict={strict})"));

    verify_fresh_assertion(account_id, &assertion)?;
    log_line(&app, "unlock: assertion verified");

    let path = blob_path(&app, account_id)?;
    if !path.exists() {
        log_line(&app, "unlock: no wrapper on disk for this account");
        return Err(DeviceUnlockError::new("NO_KEY_FOR_ACCOUNT", "No device wrapper enrolled for this account"));
    }

    if strict {
        let hwnd = main_hwnd(&window)?;
        log_line(&app, "unlock: strict — requesting Windows Hello");
        let result = request_hello_verification_with_timeout(&app, hwnd, "Unlock your encrypted chats")?;
        log_line(&app, &format!("unlock: Windows Hello result = {result:?}"));
        require_verified(result)?;
    }
    // Lenient mode: no Hello gate at all — CryptUnprotectData alone, silent,
    // gated only by "still the same logged-in Windows user." This is what
    // makes "enroll once, never asked again, even after hours" true.

    let wrapped = fs::read(&path).map_err(|e| DeviceUnlockError::new("CORRUPT_WRAPPER", format!("Could not read wrapper: {e}")))?;
    let secret_key_bytes = dpapi_unprotect(&wrapped)?;
    if secret_key_bytes.len() != 32 {
        return Err(DeviceUnlockError::new("CORRUPT_WRAPPER", "Unwrapped data is not 32 bytes"));
    }

    log_line(&app, "unlock: done, secret recovered");
    Ok(STANDARD.encode(secret_key_bytes))
}

#[tauri::command]
pub fn windows_device_unlock_clear(app: AppHandle, account_id: i64, assertion: String) -> CmdResult<()> {
    verify_fresh_assertion(account_id, &assertion)?;
    let path = blob_path(&app, account_id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not remove wrapper: {e}")))?;
    }
    Ok(())
}
