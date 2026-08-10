package com.sahaplay.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

// Keystore-backed storage for the user's long-term NaCl secret key (raw 32
// bytes) AND auth token — handed over from JS via SahaplayCallPlugin (see
// CryptoContext.jsx's kp.secretKey / localStorage's watch_token, the same
// values the web/JS layer already holds for exactly the same purpose).
// Native unavoidably needs both in memory to act on a real call regardless
// of storage choice; EncryptedSharedPreferences only hardens them at rest
// between calls, not a new class of exposure.
//
// The token specifically is what makes Phase 3's background/lock-screen
// answering possible at all: CallEngineService.ensureSelfInitialized()
// reads it here to stand up a fresh authenticated socket connection when a
// call push arrives with the app process fully killed and no WebView/JS
// context to pull a live token from.
public class SecretKeyStore {
    private static final String PREFS_NAME = "sahaplay_call_secure";
    private static final String KEY_SECRET = "nacl_secret_key";
    private static final String KEY_USERNAME = "nacl_username";
    private static final String KEY_TOKEN = "auth_token";

    private final SharedPreferences prefs;

    public SecretKeyStore(Context context) throws Exception {
        MasterKey masterKey = new MasterKey.Builder(context.getApplicationContext())
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build();
        prefs = EncryptedSharedPreferences.create(
            context.getApplicationContext(),
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    public void save(String username, byte[] secretKey) {
        if (secretKey == null) return;
        prefs.edit()
            .putString(KEY_USERNAME, username)
            .putString(KEY_SECRET, Base64.encodeToString(secretKey, Base64.NO_WRAP))
            .apply();
    }

    public byte[] load() {
        String s = prefs.getString(KEY_SECRET, null);
        if (s == null) return null;
        return Base64.decode(s, Base64.NO_WRAP);
    }

    public String loadUsername() {
        return prefs.getString(KEY_USERNAME, null);
    }

    public void saveToken(String token) {
        if (token == null) return;
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    public String loadToken() {
        return prefs.getString(KEY_TOKEN, null);
    }

    public void clear() {
        prefs.edit().clear().apply();
    }
}
