// device_assertion.rs
//
// Verifies the same short "device enrollment assertion" the backend issues
// via POST /api/auth/device-enrollment-assertion (see
// backend/lib/deviceAssertion.js for the signing side) that Android's
// DeviceAssertionVerifier.java already verifies — this is a faithful Rust
// port of that exact class, same public key, same wire format, same
// verification rules, so a single assertion string works identically on
// both platforms.
//
// Why this exists at all (see DeviceAssertionVerifier.java's own class
// comment for the full incident this closes): device_unlock.rs's DPAPI
// blobs are keyed purely by accountId, a value ONLY ever supplied by JS. A
// bare, unverified accountId claim is not authorization — any script
// running in the WebView could otherwise call windows_device_unlock_unlock
// with a DIFFERENT SahaPlay account's id and, if that account previously
// enrolled device unlock on this same Windows profile, receive ITS key
// instead of the currently-logged-in account's. Verifying a FRESH,
// asymmetrically-signed assertion (which the backend only ever issues for
// the account whose OWN, currently-valid session JWT authenticated the
// request) closes that gap the same way it already does on Android.
//
// Deliberately standalone/pure — no Tauri types, no I/O, fully unit-testable.
// Verified independently (compiled + run, all 6 tests including a real
// sign/verify round-trip) in an isolated throwaway crate before being
// placed here, since this crate's own full build requires the CI (MSVC)
// toolchain — see this feature's implementation notes for why.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ecdsa::signature::Verifier;
use p256::ecdsa::{Signature, VerifyingKey};
use p256::pkcs8::DecodePublicKey;
use serde::Deserialize;

// SPKI PEM, EC (prime256v1/P-256) — the PUBLIC half of the keypair whose
// PRIVATE half signs assertions in backend/lib/deviceAssertion.js. Safe to
// embed; disclosing it grants no ability to forge an assertion, only the
// private half (held only by the backend, in the DEVICE_ASSERTION_PRIVATE_KEY
// env var) can do that. MUST stay byte-for-byte identical to the constant
// embedded in DeviceAssertionVerifier.java — both verify assertions signed
// by the same single backend keypair.
const PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----\n\
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmA5i9Ms9M7bHCP/t0lSHLhia+PUd\n\
D9JH3TzJFYXsXm+5NoAk8i1JkmKhG99hhS4dtvz9BKKEOaMFGuj4RnZ36Q==\n\
-----END PUBLIC KEY-----";

#[derive(Debug, Deserialize)]
struct Header {
    alg: String,
}

#[derive(Debug, Deserialize)]
struct Payload {
    id: serde_json::Value, // accepts a JSON number OR numeric string, same tolerance as Android's decodeAccountIdFromToken
    #[serde(default)]
    username: Option<String>,
    exp: i64,
}

/// A signature-proven, not merely claimed, account identity — mirrors
/// DeviceAssertionVerifier.java's AssertionPayload.
pub struct AssertionPayload {
    pub id: i64,
    pub username: Option<String>,
}

fn base64url_decode(s: &str) -> Option<Vec<u8>> {
    URL_SAFE_NO_PAD.decode(s.as_bytes()).ok()
}

fn load_verifying_key() -> VerifyingKey {
    VerifyingKey::from_public_key_pem(PUBLIC_KEY_PEM)
        .expect("device_assertion: embedded public key is malformed")
}

/// Verifies one assertion string against the real, embedded production
/// public key. Returns None on ANY failure — malformed shape, bad
/// base64url, non-JSON segments, wrong algorithm, invalid signature, or
/// expiry — deliberately never distinguishing why, so every caller treats
/// every failure mode identically (mirrors DeviceAssertionVerifier.java's
/// own `verify` contract exactly).
pub fn verify(assertion: &str) -> Option<AssertionPayload> {
    verify_with_key(assertion, &load_verifying_key())
}

// Exposed for tests only — lets a test substitute a throwaway keypair's
// public key instead of the real embedded one, so tests can sign with a
// matching throwaway private key without touching production key material
// at all. Same rationale as DeviceAssertionVerifier.java's own
// package-private test constructor.
fn verify_with_key(assertion: &str, verifying_key: &VerifyingKey) -> Option<AssertionPayload> {
    let parts: Vec<&str> = assertion.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let (header_b64, payload_b64, sig_b64) = (parts[0], parts[1], parts[2]);

    let header_json = base64url_decode(header_b64)?;
    let payload_json = base64url_decode(payload_b64)?;
    let sig_der = base64url_decode(sig_b64)?;

    let header: Header = serde_json::from_slice(&header_json).ok()?;
    if header.alg != "ES256" {
        return None;
    }

    let signature = Signature::from_der(&sig_der).ok()?;
    let signing_input = format!("{header_b64}.{payload_b64}");
    verifying_key.verify(signing_input.as_bytes(), &signature).ok()?;

    let payload: Payload = serde_json::from_slice(&payload_json).ok()?;

    // Accepts id as either a JSON number or a numeric string — same
    // tolerance as backend/lib/deviceAssertion.js's own signing side
    // (Number(account.id)) and Android's decodeAccountIdFromToken, since a
    // Postgres bigint id can arrive as either depending on the path it took.
    let id = match &payload.id {
        serde_json::Value::Number(n) => n.as_i64()?,
        serde_json::Value::String(s) => s.parse::<i64>().ok()?,
        _ => return None,
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs() as i64;
    if payload.exp < now {
        return None; // expired
    }

    Some(AssertionPayload { id, username: payload.username })
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::{signature::Signer, SigningKey};

    fn now() -> i64 {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64
    }

    // Signs a throwaway-keypair assertion the exact same way
    // backend/lib/deviceAssertion.js does, so tests never touch the real
    // embedded public key/production key material.
    fn sign_test_assertion(signing_key: &SigningKey, id: i64, username: Option<&str>, exp: i64) -> String {
        let header = serde_json::json!({ "alg": "ES256", "typ": "SPDA" });
        let payload = serde_json::json!({ "id": id, "username": username, "exp": exp });
        let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string());
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload.to_string());
        let signing_input = format!("{header_b64}.{payload_b64}");
        let signature: Signature = signing_key.sign(signing_input.as_bytes());
        let sig_b64 = URL_SAFE_NO_PAD.encode(signature.to_der().as_bytes());
        format!("{signing_input}.{sig_b64}")
    }

    #[test]
    fn rejects_malformed_shape() {
        assert!(verify("not.enough").is_none());
        assert!(verify("").is_none());
        assert!(verify("a.b.c.d").is_none());
    }

    #[test]
    fn accepts_a_correctly_signed_fresh_assertion_and_returns_its_verified_payload() {
        let key = SigningKey::random(&mut rand_core::OsRng);
        let verifying_key = VerifyingKey::from(&key);
        let assertion = sign_test_assertion(&key, 42, Some("krish"), now() + 3600);
        let payload = verify_with_key(&assertion, &verifying_key).expect("a correctly signed, unexpired assertion must verify");
        assert_eq!(payload.id, 42);
        assert_eq!(payload.username.as_deref(), Some("krish"));
    }

    #[test]
    fn accepts_a_numeric_string_id_same_as_a_json_number_id() {
        // sign_test_assertion always emits a JSON number; hand-build one
        // with a string id instead to exercise the Postgres-bigint-as-string
        // tolerance path directly.
        let key = SigningKey::random(&mut rand_core::OsRng);
        let verifying_key = VerifyingKey::from(&key);
        let header = serde_json::json!({ "alg": "ES256", "typ": "SPDA" });
        let payload = serde_json::json!({ "id": "42", "username": "krish", "exp": now() + 3600 });
        let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string());
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload.to_string());
        let signing_input = format!("{header_b64}.{payload_b64}");
        let signature: Signature = key.sign(signing_input.as_bytes());
        let sig_b64 = URL_SAFE_NO_PAD.encode(signature.to_der().as_bytes());
        let assertion = format!("{signing_input}.{sig_b64}");
        let verified = verify_with_key(&assertion, &verifying_key).expect("numeric-string id must still verify");
        assert_eq!(verified.id, 42);
    }

    #[test]
    fn rejects_a_valid_signature_from_the_wrong_key() {
        // Signed correctly, just not by the key `verify_with_key` is told
        // to check against — must be rejected exactly like a forged one.
        let signing_key = SigningKey::random(&mut rand_core::OsRng);
        let unrelated_verifying_key = VerifyingKey::from(&SigningKey::random(&mut rand_core::OsRng));
        let assertion = sign_test_assertion(&signing_key, 42, Some("krish"), now() + 3600);
        assert!(verify_with_key(&assertion, &unrelated_verifying_key).is_none());
    }

    #[test]
    fn rejects_expired_assertion_even_with_a_genuinely_valid_signature() {
        let key = SigningKey::random(&mut rand_core::OsRng);
        let verifying_key = VerifyingKey::from(&key);
        let assertion = sign_test_assertion(&key, 42, Some("krish"), now() - 3600); // expired an hour ago
        assert!(verify_with_key(&assertion, &verifying_key).is_none());
    }

    #[test]
    fn rejects_non_es256_alg_even_with_a_genuinely_valid_signature() {
        let key = SigningKey::random(&mut rand_core::OsRng);
        let verifying_key = VerifyingKey::from(&key);
        let header = serde_json::json!({ "alg": "none" });
        let payload = serde_json::json!({ "id": 1, "exp": now() + 3600 });
        let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string());
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload.to_string());
        let signing_input = format!("{header_b64}.{payload_b64}");
        let signature: Signature = key.sign(signing_input.as_bytes());
        let sig_b64 = URL_SAFE_NO_PAD.encode(signature.to_der().as_bytes());
        let assertion = format!("{signing_input}.{sig_b64}");
        assert!(verify_with_key(&assertion, &verifying_key).is_none());
    }
}
