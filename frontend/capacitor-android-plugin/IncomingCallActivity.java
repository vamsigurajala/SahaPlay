package com.sahaplay.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

// Native, lock-screen-visible incoming-call screen — the piece a plain
// WebView/PWA fundamentally cannot do (no web API shows UI over a locked
// screen or rings while the app is fully killed). Built entirely in code
// (no XML layout) since there is no way to visually iterate on a layout
// resource without a real device in this environment — plain
// LinearLayout/TextView/Button composition keeps this understandable
// without one.
//
// Launched two ways: SahaplayFirebaseMessagingService.showIncomingCall()
// when a call-type FCM data message arrives (app backgrounded/killed), or
// directly by its own full-screen notification's PendingIntent. Decline
// posts straight to POST /api/calls/:callId/decline (see backend/server.js)
// over plain HTTPS — no JWT needed, this activity may be running with the
// app process otherwise fully dead, so there is no live socket or JS
// context to route the action through. Answer instead hands off to the
// already-running (or freshly launched) web app via the sahaplay://call-answer
// deep link (see AndroidManifest.xml's intent-filter + frontend/src/lib/
// nativeCallBridge.js) — accepting a call needs real getUserMedia/WebRTC,
// which only exists inside the WebView/JS layer.
public class IncomingCallActivity extends android.app.Activity {
    private static final String CHANNEL_ID = "sahaplay_incoming_call";
    private static final String API_BASE = "https://sahaplay.com";
    // Matches CALL_RING_TIMEOUT_MS in backend/server.js — the server stops
    // considering the call "ringing" at the same moment, so there's nothing
    // left to answer/decline past this point anyway.
    private static final long RING_TIMEOUT_MS = 45000;

    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_CALLER = "callerUsername";
    public static final String EXTRA_CALL_TYPE = "callType";
    public static final String EXTRA_AUTO_DECLINE = "autoDecline";

    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private String callerUsername;

    // Builds and shows the full-screen notification. Safe to call from any
    // thread/context — used both from the FCM service (background/killed
    // app) and could be reused elsewhere if ever needed.
    public static void showIncomingCall(Context ctx, String callId, String callerUsername, String callType) {
        if (callId == null || callerUsername == null) return;
        boolean isVideo = "video".equals(callType);

        Intent fullScreenIntent = new Intent(ctx, IncomingCallActivity.class);
        fullScreenIntent.putExtra(EXTRA_CALL_ID, callId);
        fullScreenIntent.putExtra(EXTRA_CALLER, callerUsername);
        fullScreenIntent.putExtra(EXTRA_CALL_TYPE, callType);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(ctx, callId.hashCode(), fullScreenIntent, piFlags);

        Intent declineIntent = new Intent(ctx, IncomingCallActivity.class);
        declineIntent.putExtra(EXTRA_CALL_ID, callId);
        declineIntent.putExtra(EXTRA_CALLER, callerUsername);
        declineIntent.putExtra(EXTRA_CALL_TYPE, callType);
        declineIntent.putExtra(EXTRA_AUTO_DECLINE, true);
        declineIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent declinePendingIntent = PendingIntent.getActivity(ctx, callId.hashCode() ^ 1, declineIntent, piFlags);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Incoming voice and video calls");
            Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri != null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                channel.setSound(ringtoneUri, attrs);
            }
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 800, 500, 800});
            nm.createNotificationChannel(channel);
        }

        Notification notification = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setContentTitle(isVideo ? "Incoming video call" : "Incoming voice call")
            .setContentText(callerUsername)
            .setSmallIcon(ctx.getApplicationInfo().icon)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(0, "Decline", declinePendingIntent)
            .addAction(0, "Answer", fullScreenPendingIntent)
            .setAutoCancel(true)
            .setOngoing(true)
            .build();

        nm.notify(callId.hashCode(), notification);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        callId = getIntent().getStringExtra(EXTRA_CALL_ID);
        callerUsername = getIntent().getStringExtra(EXTRA_CALLER);
        String callType = getIntent().getStringExtra(EXTRA_CALL_TYPE);
        boolean autoDecline = getIntent().getBooleanExtra(EXTRA_AUTO_DECLINE, false);
        boolean isVideo = "video".equals(callType);

        if (callId == null || callerUsername == null) {
            finish();
            return;
        }

        dismissNotification();

        if (autoDecline) {
            decline();
            finish();
            return;
        }

        showOverLockScreen();
        buildUi(callerUsername, isVideo);
        startRinging();
        fetchCallerDisplayName();

        handler.postDelayed(this::finishAsMissed, RING_TIMEOUT_MS);
    }

    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private TextView nameLabel;

    private void buildUi(String caller, boolean isVideo) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#0B0F1A"));
        root.setPadding(dp(24), dp(64), dp(24), dp(48));

        TextView subLabel = new TextView(this);
        subLabel.setText(isVideo ? "Incoming video call" : "Incoming voice call");
        subLabel.setTextColor(Color.parseColor("#9CA3AF"));
        subLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        subLabel.setGravity(Gravity.CENTER);
        root.addView(subLabel);

        nameLabel = new TextView(this);
        nameLabel.setText(caller);
        nameLabel.setTextColor(Color.WHITE);
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        nameLabel.setTypeface(nameLabel.getTypeface(), Typeface.BOLD);
        nameLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        nameParams.topMargin = dp(12);
        nameParams.bottomMargin = dp(1);
        root.addView(nameLabel, nameParams);

        // Spacer pushes the button row to the bottom of the screen.
        LinearLayout spacer = new LinearLayout(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(0, 0, 1f);
        root.addView(spacer, spacerParams);

        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER);

        Button declineBtn = new Button(this);
        declineBtn.setText("Decline");
        declineBtn.setTextColor(Color.WHITE);
        declineBtn.setBackgroundColor(Color.parseColor("#EF4444"));
        declineBtn.setOnClickListener(v -> { decline(); finish(); });

        Button answerBtn = new Button(this);
        answerBtn.setText(isVideo ? "Answer (Video)" : "Answer");
        answerBtn.setTextColor(Color.WHITE);
        answerBtn.setBackgroundColor(Color.parseColor("#22C55E"));
        answerBtn.setOnClickListener(v -> { answer(); finish(); });

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        btnParams.setMargins(dp(12), 0, dp(12), 0);
        buttonRow.addView(declineBtn, btnParams);
        buttonRow.addView(answerBtn, btnParams);

        root.addView(buttonRow);
        setContentView(root);
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    // Best-effort only — the FCM payload carries just the raw username, this
    // fills in the real display name once it arrives. Failure is silent and
    // harmless: the raw username is already showing as a perfectly usable
    // fallback.
    private void fetchCallerDisplayName() {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/users/" + callerUsername);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                if (conn.getResponseCode() != 200) return;
                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }
                String body = sb.toString();
                String displayName = extractJsonStringField(body, "displayName");
                if (displayName != null && !displayName.isEmpty()) {
                    handler.post(() -> { if (nameLabel != null) nameLabel.setText(displayName); });
                }
            } catch (Exception ignored) {
                // No native JSON parser available without adding a dependency —
                // extractJsonStringField below is a minimal, deliberately narrow
                // scanner for this one known field, not a general parser.
            }
        }).start();
    }

    // Deliberately minimal — avoids pulling in a JSON library dependency for
    // a single best-effort field read. Not a general-purpose JSON parser.
    private static String extractJsonStringField(String json, String field) {
        String marker = "\"" + field + "\"";
        int idx = json.indexOf(marker);
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx + marker.length());
        if (colon < 0) return null;
        int startQuote = json.indexOf('"', colon + 1);
        if (startQuote < 0) return null;
        int endQuote = startQuote + 1;
        while (endQuote < json.length() && json.charAt(endQuote) != '"') {
            if (json.charAt(endQuote) == '\\') endQuote++;
            endQuote++;
        }
        if (endQuote >= json.length()) return null;
        return json.substring(startQuote + 1, endQuote).replace("\\\"", "\"");
    }

    private void startRinging() {
        try {
            Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri != null) {
                ringtonePlayer = new MediaPlayer();
                ringtonePlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                ringtonePlayer.setDataSource(this, ringtoneUri);
                ringtonePlayer.setLooping(true);
                ringtonePlayer.prepare();
                ringtonePlayer.start();
            }
        } catch (Exception ignored) {}

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = {0, 800, 500};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
    }

    private void stopRinging() {
        if (ringtonePlayer != null) {
            try { ringtonePlayer.stop(); } catch (Exception ignored) {}
            ringtonePlayer.release();
            ringtonePlayer = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
    }

    private void dismissNotification() {
        if (callId == null) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(callId.hashCode());
    }

    // Hands off to the web app — see nativeCallBridge.js, which listens for
    // this exact deep link and tells CallContext to auto-accept the
    // matching call once it (re)connects and learns the call is still
    // ringing. Answering itself requires real getUserMedia/RTCPeerConnection,
    // which only exists in the WebView/JS layer, not here.
    private void answer() {
        Uri uri = Uri.parse("sahaplay://call-answer?callId=" + Uri.encode(callId));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage(getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
    }

    private void decline() {
        stopRinging();
        postDecline(callId, callerUsername);
    }

    private void finishAsMissed() {
        // No decline call on timeout — the caller's own client already logs
        // a "missed" call summary when the server's matching ring timeout
        // fires there (see CALL_RING_TIMEOUT_MS in backend/server.js and the
        // 'call:timeout' handler in CallContext.jsx). This just dismisses
        // the now-stale screen.
        stopRinging();
        finish();
    }

    private static void postDecline(String callId, String calleeUsername) {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/calls/" + Uri.encode(callId) + "/decline");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                String body = "{\"calleeUsername\":\"" + calleeUsername.replace("\"", "") + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode(); // force the request to actually execute
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    protected void onDestroy() {
        stopRinging();
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
