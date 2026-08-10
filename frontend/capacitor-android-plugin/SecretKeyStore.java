package com.sahaplay.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

// Keystore-backed storage for the user's long-term NaCl secret key (raw 32
// bytes), handed over once from JS via SahaplayCallPlugin.setNaclSecretKey
// (see CryptoContext.jsx's kp.secretKey — the same bytes the web/JS layer
// already holds in memory for exactly the same purpose). Native
// unavoidably needs this key in memory to decrypt real call signaling
// regardless of storage choice; EncryptedSharedPreferences only hardens it
// at rest between calls, not a new class of exposure.
public class SecretKeyStore {
    private static final String PREFS_NAME = "sahaplay_call_secure";
    private static final String KEY_SECRET = "nacl_secret_key";
    private static final String KEY_USERNAME = "nacl_username";

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

    public void clear() {
        prefs.edit().clear().apply();
    }
}
