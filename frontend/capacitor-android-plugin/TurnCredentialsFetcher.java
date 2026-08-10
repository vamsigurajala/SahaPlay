package com.sahaplay.app;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.PeerConnection;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

// Mirrors CallContext.jsx's fetchIceServers(): GET /api/turn-credentials
// (JWT-authed, proxies Metered.ca via backend/server.js), falling back to
// public STUN-only servers on any failure so a call can still attempt to
// connect rather than failing outright.
public class TurnCredentialsFetcher {
    private static final String TAG = "SahaplayCallTurn";

    public static List<PeerConnection.IceServer> fetch(String apiBase, String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase + "/api/turn-credentials");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() != 200) {
                throw new RuntimeException("turn-credentials returned " + conn.getResponseCode());
            }

            StringBuilder sb = new StringBuilder();
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            JSONArray arr = json.optJSONArray("iceServers");
            if (arr == null || arr.length() == 0) throw new RuntimeException("empty iceServers response");

            List<PeerConnection.IceServer> servers = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject entry = arr.getJSONObject(i);
                List<String> urls = new ArrayList<>();
                Object urlsField = entry.opt("urls");
                if (urlsField instanceof JSONArray) {
                    JSONArray urlsArr = (JSONArray) urlsField;
                    for (int j = 0; j < urlsArr.length(); j++) urls.add(urlsArr.getString(j));
                } else if (urlsField instanceof String) {
                    urls.add((String) urlsField);
                } else {
                    continue;
                }
                if (urls.isEmpty()) continue;
                PeerConnection.IceServer.Builder builder = PeerConnection.IceServer.builder(urls);
                String username = entry.optString("username", null);
                String credential = entry.optString("credential", null);
                if (username != null) builder.setUsername(username);
                if (credential != null) builder.setPassword(credential);
                servers.add(builder.createIceServer());
            }
            if (servers.isEmpty()) throw new RuntimeException("no usable ICE servers parsed");
            return servers;
        } catch (Exception e) {
            Log.w(TAG, "TURN credential fetch failed, falling back to STUN-only: " + e.getMessage());
            List<PeerConnection.IceServer> fallback = new ArrayList<>();
            fallback.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());
            fallback.add(PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer());
            return fallback;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
