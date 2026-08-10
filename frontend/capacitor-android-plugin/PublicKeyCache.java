package com.sahaplay.app;

import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;

// Fetches + caches other users' long-term NaCl public keys via
// GET /api/auth/public-key/:username — the same endpoint CallContext.jsx's
// fetchPublicKey() uses (backend/server.js, unauthenticated: public keys are
// meant to be shared). Returns raw 32-byte keys ready for CallCrypto.
public class PublicKeyCache {
    private static final String TAG = "SahaplayCallCrypto";

    private final String apiBase;
    private final ConcurrentHashMap<String, byte[]> cache = new ConcurrentHashMap<>();

    public PublicKeyCache(String apiBase) {
        this.apiBase = apiBase;
    }

    public byte[] get(String username) {
        String key = username.toLowerCase();
        byte[] cached = cache.get(key);
        if (cached != null) return cached;
        byte[] fetched = fetch(username);
        if (fetched != null) cache.put(key, fetched);
        return fetched;
    }

    private byte[] fetch(String username) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase + "/api/auth/public-key/" + username);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() != 200) return null;

            StringBuilder sb = new StringBuilder();
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            String pkB64 = json.isNull("publicKey") ? null : json.optString("publicKey", null);
            if (pkB64 == null || pkB64.isEmpty()) return null;
            byte[] pk = Base64.decode(pkB64, Base64.NO_WRAP);
            if (pk.length != 32) return null;
            return pk;
        } catch (Exception e) {
            Log.e(TAG, "public key fetch failed for " + username, e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
