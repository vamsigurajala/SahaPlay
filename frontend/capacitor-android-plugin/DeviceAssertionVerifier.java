package com.sahaplay.app;

import android.util.Base64;

import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.X509EncodedKeySpec;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Verifies the short "device enrollment assertion" the backend issues via
// POST /api/auth/device-enrollment-assertion (see backend/lib/deviceAssertion.js
// for the signing side and the Stage 2 security review this class exists to
// close). This is the ONLY thing that lets native code trust a caller-
// supplied account id — a bare decoded JWT claim is NOT sufficient (see the
// review), because verifying it would require the app to hold JWT_SECRET,
// which must never leave the server. This class instead verifies an
// ASYMMETRIC (ECDSA P-256 / "ES256") signature against a PUBLIC key, which
// is safe to embed here — disclosing it grants no ability to forge an
// assertion, only the private half (held only by the backend, in the
// DEVICE_ASSERTION_PRIVATE_KEY env var) can do that.
//
// Deliberately standard JCE only (java.security.*) — no third-party crypto
// library, no dependency on the "AndroidKeyStore" provider (unlike
// E2eeKeyStore, this class's own key is NOT device-bound; it's a fixed,
// public, embedded constant, so ordinary java.security.KeyFactory/Signature
// work identically on a real device, in a plain JVM, or under Robolectric —
// this class is fully unit-testable without a device/emulator, unlike
// E2eeKeyStore's Keystore-dependent methods).
public class DeviceAssertionVerifier {

    // SPKI PEM, EC (prime256v1/P-256) — the PUBLIC half of the keypair whose
    // PRIVATE half signs assertions in backend/lib/deviceAssertion.js. Safe
    // to commit/embed; see class comment. Generated once for this project;
    // rotating it requires a coordinated backend env var change + app
    // release (any assertion signed under a rotated key needs the matching
    // updated public key here to verify) — not expected to change casually.
    private static final String PUBLIC_KEY_PEM =
        "-----BEGIN PUBLIC KEY-----\n" +
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEGhhowSpCepod2ujqL8DlJzrNrMwP\n" +
        "EhbgtHAJcAxBeS/uoRllNrGozFOWF03ao+uVvqn42Qth+wdOhMDkqhIX8A==\n" +
        "-----END PUBLIC KEY-----";

    private static final Pattern PEM_STRIP = Pattern.compile("-----(BEGIN|END) PUBLIC KEY-----|\\s");

    /** Result of a successful verification — a signature-proven, not merely claimed, account identity. */
    public static class AssertionPayload {
        public final long id;
        public final String username; // informational — safe to display, but never used as a lookup key
        public final long expEpochSeconds;

        AssertionPayload(long id, String username, long expEpochSeconds) {
            this.id = id;
            this.username = username;
            this.expEpochSeconds = expEpochSeconds;
        }
    }

    private final PublicKey publicKey;

    public DeviceAssertionVerifier() {
        this.publicKey = loadEmbeddedPublicKey();
    }

    // Exposed for tests only — lets a test substitute a throwaway keypair's
    // public key instead of the real embedded one, so tests can also sign
    // with a matching throwaway private key without touching production
    // key material at all.
    DeviceAssertionVerifier(PublicKey testPublicKey) {
        this.publicKey = testPublicKey;
    }

    private static PublicKey loadEmbeddedPublicKey() {
        try {
            String base64 = PEM_STRIP.matcher(PUBLIC_KEY_PEM).replaceAll("");
            byte[] der = Base64.decode(base64, Base64.DEFAULT);
            KeyFactory keyFactory = KeyFactory.getInstance("EC");
            return keyFactory.generatePublic(new X509EncodedKeySpec(der));
        } catch (NoSuchAlgorithmException | InvalidKeySpecException | IllegalArgumentException e) {
            // The embedded constant is malformed — this is a build-time bug,
            // not a runtime/attacker-controlled condition. Fail loudly
            // rather than silently accepting every assertion as "unverifiable"
            // (which callers must already treat as "reject", so failing
            // loudly here changes nothing about safety, only diagnosability).
            throw new IllegalStateException("DeviceAssertionVerifier: embedded public key is malformed", e);
        }
    }

    /**
     * Verifies one assertion string. Returns null on ANY failure —
     * malformed shape, bad base64url, non-JSON segments, wrong algorithm,
     * invalid signature, or expiry — deliberately never throwing, so every
     * caller can treat every failure mode identically (fall back to
     * "no valid assertion for this account," never distinguish WHY).
     */
    public AssertionPayload verify(String assertion) {
        if (assertion == null) return null;
        String[] parts = assertion.split("\\.", -1);
        if (parts.length != 3) return null;

        byte[] headerJson, payloadJson, signature;
        try {
            headerJson = base64UrlDecode(parts[0]);
            payloadJson = base64UrlDecode(parts[1]);
            signature = base64UrlDecode(parts[2]);
        } catch (IllegalArgumentException e) {
            return null;
        }

        try {
            org.json.JSONObject header = new org.json.JSONObject(new String(headerJson, "UTF-8"));
            if (!"ES256".equals(header.optString("alg"))) return null;
        } catch (Exception e) {
            return null;
        }

        boolean sigValid;
        try {
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update((parts[0] + "." + parts[1]).getBytes("UTF-8"));
            sigValid = verifier.verify(signature);
        } catch (Exception e) {
            // Any crypto-layer exception (malformed DER signature, etc.) is
            // just another way to fail verification, not a special case.
            return null;
        }
        if (!sigValid) return null;

        try {
            org.json.JSONObject payload = new org.json.JSONObject(new String(payloadJson, "UTF-8"));
            long id = payload.getLong("id");
            long exp = payload.getLong("exp");
            String username = payload.isNull("username") ? null : payload.optString("username", null);

            long nowEpochSeconds = System.currentTimeMillis() / 1000L;
            if (exp < nowEpochSeconds) return null; // expired

            return new AssertionPayload(id, username, exp);
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] base64UrlDecode(String s) {
        // Matches backend/lib/deviceAssertion.js's base64url() exactly:
        // '-'->'+', '_'->'/', re-pad with '='. Base64.URL_SAFE alone doesn't
        // handle missing padding, so padding is restored explicitly first.
        String padded = s.replace('-', '+').replace('_', '/');
        int pad = (4 - (padded.length() % 4)) % 4;
        StringBuilder sb = new StringBuilder(padded);
        for (int i = 0; i < pad; i++) sb.append('=');
        return Base64.decode(sb.toString(), Base64.DEFAULT);
    }
}
