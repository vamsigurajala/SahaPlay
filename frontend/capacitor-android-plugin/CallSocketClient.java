package com.sahaplay.app;

import android.util.Log;

import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.HashMap;

import io.socket.client.IO;
import io.socket.client.Socket;

// Thin wrapper around the Socket.IO Java client, speaking the exact same
// call:* event protocol as CallContext.jsx's own socket connection (see
// backend/server.js's call: handlers). A second, independent authenticated
// connection alongside the WebView's own — the backend fans call:* events
// out to every connected socket for a given username, so during Phase 2
// testing both sockets being alive at once only matters for INCOMING calls
// (see CallEngineService's class comment on the debug-trigger scope).
public class CallSocketClient {
    private static final String TAG = "SahaplayCallSocket";

    public interface EventHandler {
        void onEvent(String event, JSONObject data);
    }

    private static final String[] LISTENED_EVENTS = {
        "call:incoming", "call:busy", "call:invalid", "call:cancelled",
        "call:timeout", "call:answered", "call:accepted", "call:offer",
        "call:answer", "call:ice", "call:state", "call:ended", "call:declined",
    };

    private Socket socket;

    public void connect(String apiBase, String token, EventHandler handler) {
        try {
            IO.Options opts = new IO.Options();
            opts.auth = new HashMap<>();
            opts.auth.put("token", token);
            socket = IO.socket(apiBase, opts);

            for (String event : LISTENED_EVENTS) {
                final String ev = event;
                socket.on(ev, args -> {
                    JSONObject data = (args.length > 0 && args[0] instanceof JSONObject) ? (JSONObject) args[0] : new JSONObject();
                    handler.onEvent(ev, data);
                });
            }
            socket.on(Socket.EVENT_CONNECT, args -> Log.i(TAG, "connected"));
            socket.on(Socket.EVENT_DISCONNECT, args -> Log.i(TAG, "disconnected: " + (args.length > 0 ? args[0] : "")));
            socket.on(Socket.EVENT_CONNECT_ERROR, args -> Log.w(TAG, "connect_error: " + (args.length > 0 ? args[0] : "")));
            socket.connect();
        } catch (URISyntaxException e) {
            Log.e(TAG, "bad API base URI: " + apiBase, e);
        }
    }

    public void emit(String event, JSONObject payload) {
        if (socket == null) return;
        socket.emit(event, payload);
    }

    public void disconnect() {
        if (socket == null) return;
        socket.disconnect();
        socket.off();
        socket = null;
    }

    public boolean isConnected() {
        return socket != null && socket.connected();
    }
}
