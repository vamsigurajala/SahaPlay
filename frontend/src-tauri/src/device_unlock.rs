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
use std::path::PathBuf;

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
            let _ = LocalFree(HLOCAL(output.pbData as *mut _ as isize));
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
            let _ = LocalFree(HLOCAL(output.pbData as *mut _ as isize));
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

/// Maps a Windows Hello outcome to the shared DeviceUnlockError vocabulary.
/// Ok(()) means Verified — proceed to DPAPI unwrap. Every other outcome is
/// a typed rejection; NONE of them are ever grounds to touch the DPAPI
/// blob or regenerate an E2EE keypair.
fn require_verified(result: UserConsentVerificationResult) -> CmdResult<()> {
    use UserConsentVerificationResult::*;
    match result {
        Verified => Ok(()),
        Canceled => Err(DeviceUnlockError::new("AUTH_FAILED", "Windows Hello verification was canceled")),
        RetriesExhausted => Err(DeviceUnlockError::new("AUTH_FAILED", "Too many failed Windows Hello attempts")),
        NotConfiguredForUser => Err(DeviceUnlockError::new(
            "NOT_CONFIGURED",
            "Windows Hello is not set up for this Windows account",
        )),
        DisabledByPolicy => Err(DeviceUnlockError::new("NOT_CONFIGURED", "Windows Hello is disabled by policy")),
        DeviceNotPresent => Err(DeviceUnlockError::new("HARDWARE_UNAVAILABLE", "No Windows Hello hardware present")),
        DeviceBusy => Err(DeviceUnlockError::new("HARDWARE_UNAVAILABLE", "Windows Hello device is busy")),
        _ => Err(DeviceUnlockError::new("AUTH_FAILED", "Windows Hello verification did not succeed")),
    }
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

#[tauri::command]
pub fn windows_device_unlock_setup(
    app: AppHandle,
    window: WebviewWindow,
    account_id: i64,
    assertion: String,
    secret_key_base64: String,
    allow_overwrite: bool,
    strict: bool,
) -> CmdResult<()> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    verify_fresh_assertion(account_id, &assertion)?;

    let path = blob_path(&app, account_id)?;
    if !allow_overwrite && path.exists() {
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
        let result = request_hello_verification(hwnd, "Confirm to enable Device Unlock")?;
        require_verified(result)?;
    }

    let wrapped = dpapi_protect(&secret_key_bytes)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not create device_unlock dir: {e}")))?;
    }
    fs::write(&path, &wrapped).map_err(|e| DeviceUnlockError::new("HARDWARE_UNAVAILABLE", format!("Could not write wrapper: {e}")))?;

    Ok(())
}

#[tauri::command]
pub fn windows_device_unlock_unlock(
    app: AppHandle,
    window: WebviewWindow,
    account_id: i64,
    assertion: String,
    strict: bool,
) -> CmdResult<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    verify_fresh_assertion(account_id, &assertion)?;

    let path = blob_path(&app, account_id)?;
    if !path.exists() {
        return Err(DeviceUnlockError::new("NO_KEY_FOR_ACCOUNT", "No device wrapper enrolled for this account"));
    }

    if strict {
        let hwnd = main_hwnd(&window)?;
        let result = request_hello_verification(hwnd, "Unlock your encrypted chats")?;
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
