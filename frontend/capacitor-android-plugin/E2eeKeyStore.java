package com.sahaplay.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.security.keystore.StrongBoxUnavailableException;
import android.util.Base64;

import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.UnrecoverableKeyException;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

// Device-bound storage for a device-LOCAL copy of the account's existing
// 32-byte NaCl secret key — the E2EE "device unlock" feature. This is a
// deliberately SEPARATE class from SecretKeyStore.java, which exists for a
// different purpose (CallEngineService's unconditional, no-user-present
// background call-answering) with a different, incompatible trust posture
// (no authentication gate at all, single global un-partitioned prefs file).
// Reusing SecretKeyStore here would either break calling (if gated behind
// biometrics) or leave the E2EE key readable with zero authentication (if
// not) — see the architecture investigation this class implements. Do not
// merge these two classes.
//
// Why plain SharedPreferences instead of androidx.security's
// EncryptedSharedPreferences/MasterKey (what SecretKeyStore.java uses): the
// value stored here is already AES-256-GCM ciphertext produced by a
// Keystore-resident, non-exportable, user-authentication-gated key — it is
// already opaque without that specific key, and Android's own per-app
// storage sandboxing already keeps the file unreadable to every other app
// regardless of encryption. A second EncryptedSharedPreferences layer on
// top would add no real protection (its own MasterKey has no user-
// authentication requirement at all, so it wouldn't even add an auth gate)
// while pulling in machinery this class doesn't need. It also couldn't
// express the modern setUserAuthenticationParameters(timeout, AUTH_*) API
// this design specifically wants — MasterKey.Builder only exposes the
// legacy validity-duration form. Real security here comes entirely from
// the AndroidKeyStore key itself, not from how the ciphertext blob sitting
// next to it is stored.
//
// Threading: every public method here does blocking I/O (SharedPreferences
// commit-on-apply is async internally, but Keystore/Cipher calls are
// synchronous) and potentially blocking Keystore/HSM calls. Callers
// (SahaplayE2eePlugin, added in a later stage) are responsible for calling
// these off the main thread.
public class E2eeKeyStore {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String PREFS_NAME = "sahaplay_e2ee_store";
    private static final String ALIAS_PREFIX = "sahaplay_e2ee_key_";
    private static final int AUTH_VALIDITY_SECONDS = 1800; // 30 minutes, per design doc
    private static final int GCM_TAG_BITS = 128;

    private final Context appContext;
    private final SharedPreferences prefs;

    public E2eeKeyStore(Context context) {
        this.appContext = context.getApplicationContext();
        // MODE_PRIVATE: readable only by this app's own UID — the same
        // guarantee every other private file on the device already has,
        // regardless of this feature.
        this.prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ─── Thrown, typed failure signals ────────────────────────────────────
    // Deliberately distinct from KeyPermanentlyInvalidatedException /
    // UserNotAuthenticatedException (both standard Android exceptions,
    // left to propagate as-is so the caller can distinguish "needs a
    // biometric prompt" from "this key is gone forever" using the same
    // types Android itself defines) — these two are this class's OWN
    // vocabulary for states Android has no exception for.

    /** No device wrapper exists for this account on this device at all. */
    public static class NoDeviceUnlockException extends GeneralSecurityException {
        public NoDeviceUnlockException(String message) { super(message); }
    }

    /**
     * setupDeviceUnlock was called with allowOverwrite=false but a wrapper
     * already exists for this account. Thrown BEFORE any Keystore key is
     * touched — see setupDeviceUnlock's own comment for why this guard
     * exists.
     */
    public static class DeviceUnlockAlreadyExistsException extends GeneralSecurityException {
        public DeviceUnlockAlreadyExistsException(String message) { super(message); }
    }

    /**
     * The stored blob failed to decrypt for a reason that is NOT
     * authentication (bad tag, truncated data, missing IV) — i.e. the
     * wrapper itself is corrupt, not merely locked. Distinguished from
     * KeyPermanentlyInvalidatedException so callers can tell "the key is
     * fine but the ciphertext next to it is garbage" apart from "the key
     * itself is gone" — both currently get the same treatment upstream
     * (discard + fall back to passphrase, never regenerate a keypair) but
     * are worth keeping distinguishable for diagnostics.
     */
    public static class CorruptDeviceWrapperException extends GeneralSecurityException {
        public CorruptDeviceWrapperException(String message, Throwable cause) { super(message, cause); }
    }

    // ─── Per-account key naming ────────────────────────────────────────────
    // Callers MUST pass the account's stable numeric id (from the JWT's
    // `id` claim), never the mutable username — usernames can be changed
    // (see /api/profile/username) and must never be the cryptographic
    // identity boundary. Username is stored alongside purely as a display
    // hint for the biometric prompt subtitle (added in a later stage), and
    // is never used to look anything up.
    private static String aliasFor(long accountId) {
        return ALIAS_PREFIX + accountId;
    }
    private static String prefKeyBlob(long accountId)     { return "wrapped_key_" + accountId; }
    private static String prefKeyUsername(long accountId) { return "username_hint_" + accountId; }
    private static String prefKeyStrongBox(long accountId){ return "strongbox_" + accountId; }

    // NOTE: an earlier revision of this class also cached the device-
    // enrollment assertion here (cacheAssertion/getCachedAssertion), to let
    // an offline cold start reuse a previously-fetched assertion instead of
    // requiring a fresh network fetch. That was REMOVED after a security
    // review found it unsafe: a cached assertion only proves an account was
    // authenticated at SOME past point within its ~24h validity, not that
    // it is the account CURRENTLY driving the WebView session — a logged-
    // out account's still-valid cached assertion could otherwise be reused
    // by a different, currently-active (and possibly compromised) account's
    // session to reach the logged-out account's key. SahaplayE2eePlugin.java
    // now requires a freshly-supplied assertion for every security-relevant
    // operation, with no fallback to anything stored here. Do not
    // reintroduce assertion caching in this class.

    // ─── Existence check ────────────────────────────────────────────────────
    public boolean hasWrappedKey(long accountId) {
        return prefs.contains(prefKeyBlob(accountId));
    }

    /** Display-only hint for a biometric prompt subtitle. Never used for lookups. */
    public String getUsernameHint(long accountId) {
        return prefs.getString(prefKeyUsername(accountId), null);
    }

    /** Diagnostic-only — see the architecture doc's StrongBox section. Never gates functionality. */
    public boolean wasStrongBoxUsed(long accountId) {
        return prefs.getBoolean(prefKeyStrongBox(accountId), false);
    }

    // ─── Setup (enrollment) ─────────────────────────────────────────────────
    /**
     * Step 1 of enrollment: generates (or, if allowOverwrite, regenerates) the
     * Keystore key for this account and returns a live, ENCRYPT-mode Cipher
     * ready to wrap the secret key bytes.
     *
     * Deliberately split from finishSetup(): generating a
     * setUserAuthenticationRequired(true) key does not itself demand
     * authentication, but USING it (even to encrypt) does — the very first
     * cipher.doFinal() call against a brand-new such key throws
     * UserNotAuthenticatedException, exactly the same as an expired unlock
     * window. The caller (the plugin, in a later stage, which owns
     * BiometricPrompt/Activity context — this class deliberately has none)
     * needs a live Cipher object to hand to BiometricPrompt.CryptoObject
     * when that happens, which means this class cannot both generate the
     * key AND perform the encryption in one opaque call.
     *
     * Does NOT persist anything yet — nothing is written to prefs until
     * finishSetup() succeeds, so a failure partway through this step never
     * leaves a half-written wrapper.
     *
     * @throws DeviceUnlockAlreadyExistsException if a wrapper already exists
     *         and allowOverwrite is false. This is the guard against the
     *         bridge becoming "an unrestricted primitive that allows
     *         arbitrary key overwrite" — callers must pass allowOverwrite=true
     *         only from an explicit, user-visible re-enrollment action, never
     *         as a silent side effect of an ordinary unlock attempt.
     */
    public Cipher prepareSetupCipher(long accountId, boolean allowOverwrite) throws GeneralSecurityException {
        if (!allowOverwrite && hasWrappedKey(accountId)) {
            throw new DeviceUnlockAlreadyExistsException(
                "Device unlock already enrolled for account " + accountId + " — pass allowOverwrite=true from an explicit re-enrollment flow to replace it.");
        }

        String alias = aliasFor(accountId);
        boolean strongBoxUsed = generateKey(alias);
        prefs.edit().putBoolean(prefKeyStrongBox(accountId), strongBoxUsed).apply();

        SecretKey key = loadKeystoreKey(alias);
        Cipher cipher = Cipher.getInstance(KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_GCM + "/" + KeyProperties.ENCRYPTION_PADDING_NONE);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return cipher;
    }

    /**
     * Step 2 of enrollment: given a Cipher that has already been through a
     * successful BiometricPrompt.CryptoObject authentication (or didn't
     * need one — see prepareSetupCipher's comment; on some devices/API
     * levels the very first use after generation can still succeed
     * silently), encrypts secretKeyBytes and persists the wrapped blob.
     *
     * secretKeyBytes is the account's EXISTING 32-byte NaCl secret key —
     * this method never generates, rotates, or in any way alters the
     * account's E2EE identity. It only wraps a copy of a value the caller
     * already obtained through the existing passphrase/recovery path.
     */
    public void finishSetup(long accountId, String usernameHint, Cipher encryptCipher, byte[] secretKeyBytes) throws GeneralSecurityException {
        byte[] iv = encryptCipher.getIV();
        byte[] ciphertext = encryptCipher.doFinal(secretKeyBytes);
        String packed = packIvAndCiphertext(iv, ciphertext);

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(prefKeyBlob(accountId), packed);
        if (usernameHint != null) {
            editor.putString(prefKeyUsername(accountId), usernameHint);
        }
        editor.apply();
    }

    // ─── Unlock ─────────────────────────────────────────────────────────────
    /**
     * Step 1 of unlock: loads the stored IV and returns a live, DECRYPT-mode
     * Cipher. Initializing the cipher does not by itself require fresh
     * authentication; the caller should immediately attempt finishUnlock()
     * with it — if the authentication-validity window (30 minutes, see
     * class doc) is still open, that succeeds with NO UI at all. Only if it
     * throws UserNotAuthenticatedException does the caller need to show
     * BiometricPrompt wrapping this exact Cipher object and retry
     * finishUnlock() with the now-authenticated instance from the prompt's
     * own result.
     *
     * @throws NoDeviceUnlockException if nothing is enrolled for this account.
     * @throws KeyPermanentlyInvalidatedException if the Keystore key is gone
     *         (biometric enrollment changed, device credential removed,
     *         etc.) — callers must treat this as "discard this wrapper and
     *         fall back to the passphrase/recovery flow," NEVER as grounds
     *         to generate a new E2EE keypair.
     */
    public Cipher prepareUnlockCipher(long accountId) throws GeneralSecurityException {
        if (!hasWrappedKey(accountId)) {
            throw new NoDeviceUnlockException("No device wrapper enrolled for account " + accountId);
        }
        String alias = aliasFor(accountId);
        SecretKey key = loadKeystoreKey(alias); // may itself surface UnrecoverableKeyException if invalidated

        byte[][] parts;
        try {
            parts = unpackIvAndCiphertext(prefs.getString(prefKeyBlob(accountId), null));
        } catch (IllegalArgumentException e) {
            throw new CorruptDeviceWrapperException("Stored wrapper for account " + accountId + " is malformed", e);
        }

        Cipher cipher = Cipher.getInstance(KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_GCM + "/" + KeyProperties.ENCRYPTION_PADDING_NONE);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, parts[0]));
        return cipher;
    }

    /**
     * Step 2 of unlock: performs the actual decrypt. This is the call that
     * throws UserNotAuthenticatedException when the auth window has lapsed
     * (see prepareUnlockCipher's doc) — cipher.init() alone does not throw
     * it; only the operation itself does.
     *
     * @throws CorruptDeviceWrapperException if the ciphertext doesn't
     *         authenticate (AEADBadTagException) — a corrupted wrapper, not
     *         an authentication problem. Callers must treat this exactly
     *         like KeyPermanentlyInvalidatedException: discard and fall
     *         back to passphrase/recovery, never regenerate a keypair.
     */
    public byte[] finishUnlock(long accountId, Cipher decryptCipher) throws GeneralSecurityException {
        byte[][] parts;
        try {
            parts = unpackIvAndCiphertext(prefs.getString(prefKeyBlob(accountId), null));
        } catch (IllegalArgumentException e) {
            throw new CorruptDeviceWrapperException("Stored wrapper for account " + accountId + " is malformed", e);
        }
        try {
            return decryptCipher.doFinal(parts[1]);
        } catch (AEADBadTagException e) {
            throw new CorruptDeviceWrapperException("Stored wrapper for account " + accountId + " failed to authenticate (corrupt)", e);
        }
    }

    // ─── Deletion ("Forget this device") ────────────────────────────────────
    /**
     * Deletes both the Keystore key and the stored wrapper/metadata for one
     * account. Idempotent — safe to call even if nothing is enrolled.
     * Deliberately does NOT touch any other account's alias/prefs entries
     * (each is independently keyed by accountId) and does NOT touch
     * SecretKeyStore.java's calling-storage file at all.
     */
    public void clearDeviceUnlock(long accountId) {
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            String alias = aliasFor(accountId);
            if (keyStore.containsAlias(alias)) {
                keyStore.deleteEntry(alias);
            }
        } catch (GeneralSecurityException | java.io.IOException e) {
            // Best-effort: even if the Keystore delete fails for some reason,
            // still remove the local ciphertext below so hasWrappedKey()
            // stops reporting an enrollment that (at best) can't be reached
            // without the alias anyway.
        }
        prefs.edit()
            .remove(prefKeyBlob(accountId))
            .remove(prefKeyUsername(accountId))
            .remove(prefKeyStrongBox(accountId))
            .apply();
    }

    // ─── Internal: Keystore key generation (StrongBox-opportunistic) ───────
    /**
     * Generates a fresh AES-256-GCM key in AndroidKeyStore for the given
     * alias, gated by user authentication with a 30-minute validity window.
     * Attempts StrongBox first (API 28+) and transparently falls back to a
     * TEE/software-backed key on StrongBoxUnavailableException — StrongBox
     * is never required, per the architecture doc's explicit instruction.
     * If a key with this alias already exists, generating a new one
     * overwrites it in place (Android Keystore's normal behavior) — callers
     * only reach this method after prepareSetupCipher's own overwrite guard
     * has already been checked.
     *
     * @return true if the key actually ended up StrongBox-backed (diagnostic only).
     */
    private boolean generateKey(String alias) throws GeneralSecurityException {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);

        boolean attemptStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P;
        if (attemptStrongBox) {
            try {
                keyGenerator.init(buildKeySpec(alias, true));
                keyGenerator.generateKey();
                return true;
            } catch (StrongBoxUnavailableException e) {
                // Fall through to the non-StrongBox spec below. A fresh
                // KeyGenerator instance isn't required here — init() simply
                // overwrites the previous (failed) spec.
            }
        }

        keyGenerator.init(buildKeySpec(alias, false));
        keyGenerator.generateKey();
        return false;
    }

    private static KeyGenParameterSpec buildKeySpec(String alias, boolean strongBox) {
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true);

        // Modern, type-specific validity-window API (API 30+) — lets the key
        // accept EITHER a strong biometric OR the device credential (PIN/
        // pattern/password) as satisfying authentication, with an explicit
        // timeout rather than "every single use." Below API 30,
        // setUserAuthenticationValidityDurationSeconds is the only available
        // equivalent and cannot restrict which authentication class counts.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                AUTH_VALIDITY_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(AUTH_VALIDITY_SECONDS);
        }

        if (strongBox) {
            builder.setIsStrongBoxBacked(true);
        }

        return builder.build();
    }

    private static SecretKey loadKeystoreKey(String alias) throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        try {
            keyStore.load(null);
        } catch (java.io.IOException e) {
            throw new GeneralSecurityException("Failed to load AndroidKeyStore", e);
        }
        KeyStore.Entry entry = keyStore.getEntry(alias, null);
        if (!(entry instanceof KeyStore.SecretKeyEntry)) {
            throw new UnrecoverableKeyException("No AndroidKeyStore entry for alias " + alias);
        }
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
    }

    // ─── Internal: IV + ciphertext packing ─────────────────────────────────
    // Same "pack the IV alongside the ciphertext, base64 the whole thing"
    // shape as crypto.js's own encryptPrivateKey (salt|iv|ciphertext) —
    // kept deliberately simple and consistent with that existing pattern
    // rather than inventing a different envelope format on the native side.
    // Format: base64( [1 byte ivLength] [iv] [ciphertext incl. GCM tag] ).
    static String packIvAndCiphertext(byte[] iv, byte[] ciphertext) {
        byte[] packed = new byte[1 + iv.length + ciphertext.length];
        packed[0] = (byte) iv.length;
        System.arraycopy(iv, 0, packed, 1, iv.length);
        System.arraycopy(ciphertext, 0, packed, 1 + iv.length, ciphertext.length);
        return Base64.encodeToString(packed, Base64.NO_WRAP);
    }

    static byte[][] unpackIvAndCiphertext(String packedBase64) {
        if (packedBase64 == null) {
            throw new IllegalArgumentException("No stored wrapper");
        }
        byte[] packed;
        try {
            packed = Base64.decode(packedBase64, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Stored wrapper is not valid base64", e);
        }
        if (packed.length < 1) {
            throw new IllegalArgumentException("Stored wrapper is empty");
        }
        int ivLength = packed[0] & 0xFF;
        if (ivLength <= 0 || packed.length < 1 + ivLength) {
            throw new IllegalArgumentException("Stored wrapper has an invalid IV length");
        }
        byte[] iv = new byte[ivLength];
        byte[] ciphertext = new byte[packed.length - 1 - ivLength];
        System.arraycopy(packed, 1, iv, 0, ivLength);
        System.arraycopy(packed, 1 + ivLength, ciphertext, 0, ciphertext.length);
        return new byte[][] { iv, ciphertext };
    }
}
