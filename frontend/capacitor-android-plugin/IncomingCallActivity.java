package com.sahaplay.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

import java.io.BufferedReader;
import java.io.InputStream;
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
// LinearLayout/TextView/Button/ImageView composition keeps this
// understandable without one.
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
    // The recipient's OWN username — i.e. whoever this device is logged in
    // as. Declining has to tell the backend WHO is declining so it can find
    // and remove the right side of the call (POST /api/calls/:callId/decline
    // matches this against the call's actual callee/member entry); this used
    // to be missing entirely, with decline() accidentally sending the
    // CALLER's username in that field instead (see the fixed decline()
    // below) — the backend could never match that against anything, so the
    // POST silently 404'd and nothing happened for either side.
    public static final String EXTRA_CALLEE = "calleeUsername";
    public static final String EXTRA_CALL_TYPE = "callType";
    public static final String EXTRA_AUTO_DECLINE = "autoDecline";

    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private String callerUsername;
    private String calleeUsername;

    // Builds and shows the full-screen notification. Safe to call from any
    // thread/context — used both from the FCM service (background/killed
    // app) and could be reused elsewhere if ever needed.
    public static void showIncomingCall(Context ctx, String callId, String callerUsername, String callType, String calleeUsername) {
        if (callId == null || callerUsername == null) return;
        boolean isVideo = "video".equals(callType);

        Intent fullScreenIntent = new Intent(ctx, IncomingCallActivity.class);
        fullScreenIntent.putExtra(EXTRA_CALL_ID, callId);
        fullScreenIntent.putExtra(EXTRA_CALLER, callerUsername);
        fullScreenIntent.putExtra(EXTRA_CALL_TYPE, callType);
        fullScreenIntent.putExtra(EXTRA_CALLEE, calleeUsername);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(ctx, callId.hashCode(), fullScreenIntent, piFlags);

        Intent declineIntent = new Intent(ctx, IncomingCallActivity.class);
        declineIntent.putExtra(EXTRA_CALL_ID, callId);
        declineIntent.putExtra(EXTRA_CALLER, callerUsername);
        declineIntent.putExtra(EXTRA_CALL_TYPE, callType);
        declineIntent.putExtra(EXTRA_CALLEE, calleeUsername);
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
        calleeUsername = getIntent().getStringExtra(EXTRA_CALLEE);
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
        fetchCallerDetails();

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
    private ImageView avatarImage;

    private void buildUi(String caller, boolean isVideo) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#0B0F1A"));
        root.setPadding(dp(24), dp(72), dp(24), dp(40));

        // Spacer above the avatar — weights the avatar block toward the
        // upper-middle of the screen, buttons anchored to the bottom below.
        root.addView(new LinearLayout(this), new LinearLayout.LayoutParams(0, 0, 1f));

        // Avatar: a colored circle with initials shown immediately (no
        // network round-trip needed to render something), swapped for the
        // real photo once fetchCallerDetails() below resolves it.
        int avatarSize = dp(112);
        FrameLayout avatarFrame = new FrameLayout(this);
        root.addView(avatarFrame, new LinearLayout.LayoutParams(avatarSize, avatarSize));

        View avatarBg = new View(this);
        GradientDrawable avatarBgDrawable = new GradientDrawable();
        avatarBgDrawable.setShape(GradientDrawable.OVAL);
        avatarBgDrawable.setColor(Color.parseColor(colorForUsername(caller)));
        avatarBg.setBackground(avatarBgDrawable);
        avatarFrame.addView(avatarBg, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        TextView initials = new TextView(this);
        initials.setText(initialsFor(caller));
        initials.setTextColor(Color.WHITE);
        initials.setTextSize(TypedValue.COMPLEX_UNIT_SP, 36);
        initials.setTypeface(initials.getTypeface(), Typeface.BOLD);
        initials.setGravity(Gravity.CENTER);
        avatarFrame.addView(initials, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        avatarImage = new ImageView(this);
        avatarImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatarImage.setVisibility(View.GONE);
        avatarFrame.addView(avatarImage, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        nameLabel = new TextView(this);
        nameLabel.setText(caller);
        nameLabel.setTextColor(Color.WHITE);
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        nameLabel.setTypeface(nameLabel.getTypeface(), Typeface.BOLD);
        nameLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        nameParams.topMargin = dp(20);
        root.addView(nameLabel, nameParams);

        TextView subLabel = new TextView(this);
        subLabel.setText(isVideo ? "Incoming video call" : "Incoming voice call");
        subLabel.setTextColor(Color.parseColor("#9CA3AF"));
        subLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        subLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subParams.topMargin = dp(6);
        root.addView(subLabel, subParams);

        // Spacer below the name/subtitle block, pushes the button row to the
        // very bottom of the screen.
        root.addView(new LinearLayout(this), new LinearLayout.LayoutParams(0, 0, 1.4f));

        // Button row: explicit MATCH_PARENT width (not left to inherited
        // defaults) so it reliably spans the full content area edge to edge
        // within root's own 24dp padding — the two pill buttons then split
        // that width exactly in half with only a small fixed gap between
        // them and NO extra outer margin, so neither side reads as leftover
        // empty space.
        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(buttonRow, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        Button declineBtn = pillButton("✕", "Decline", "#EF4444");
        declineBtn.setOnClickListener(v -> { decline(); finish(); });

        Button answerBtn = pillButton("☎", "Answer", "#22C55E");
        answerBtn.setOnClickListener(v -> { answer(); finish(); });

        LinearLayout.LayoutParams leftBtnParams = new LinearLayout.LayoutParams(0, dp(56), 1f);
        leftBtnParams.setMargins(0, 0, dp(6), 0);
        LinearLayout.LayoutParams rightBtnParams = new LinearLayout.LayoutParams(0, dp(56), 1f);
        rightBtnParams.setMargins(dp(6), 0, 0, 0);

        buttonRow.addView(declineBtn, leftBtnParams);
        buttonRow.addView(answerBtn, rightBtnParams);

        setContentView(root);
    }

    // Icon glyph + label pill button — rounded corners at half the button's
    // own height (dp(56) in buildUi() above) reads as a fully smooth pill
    // rather than a rounded rectangle. Plain Unicode glyphs (no new drawable
    // resources/icon library needed): a plain telephone glyph reliably
    // renders on Android's default system font.
    private Button pillButton(String icon, String label, String colorHex) {
        Button btn = new Button(this);
        btn.setText(icon + "   " + label);
        btn.setAllCaps(false);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        btn.setTypeface(btn.getTypeface(), Typeface.BOLD);
        btn.setPadding(0, 0, 0, 0);
        btn.setStateListAnimator(null); // no default Material press elevation/shadow jump
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(colorHex));
        bg.setCornerRadius(dp(28));
        btn.setBackground(bg);
        return btn;
    }

    private static String initialsFor(String name) {
        if (name == null || name.isEmpty()) return "?";
        String clean = name.replaceAll("[^a-zA-Z0-9]", "");
        if (clean.isEmpty()) return "?";
        return clean.substring(0, Math.min(2, clean.length())).toUpperCase();
    }

    private static String colorForUsername(String name) {
        String[] palette = {"#7c3aed", "#2563eb", "#db2777", "#ea580c", "#059669", "#dc2626", "#0891b2"};
        int hash = 0;
        if (name != null) {
            for (int i = 0; i < name.length(); i++) hash = name.charAt(i) + ((hash << 5) - hash);
        }
        return palette[Math.abs(hash) % palette.length];
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    // Best-effort only — the FCM payload carries just the raw username, this
    // fills in the real display name and avatar once they arrive. Failure is
    // silent and harmless: the raw username + initials placeholder already
    // showing is a perfectly usable fallback.
    private void fetchCallerDetails() {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/users/" + Uri.encode(callerUsername));
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
                String avatarPath = extractJsonStringField(body, "avatarPath");
                if (avatarPath != null && !avatarPath.isEmpty()) {
                    String avatarUrl = avatarPath.startsWith("http") ? avatarPath : (API_BASE + avatarPath);
                    fetchAndSetAvatarBitmap(avatarUrl);
                }
            } catch (Exception ignored) {
                // No native JSON parser available without adding a dependency —
                // extractJsonStringField below is a minimal, deliberately narrow
                // scanner for these two known fields, not a general parser.
            }
        }).start();
    }

    // Runs on the same background thread fetchCallerDetails() already
    // started, keeping this second network hop off the main thread too.
    private void fetchAndSetAvatarBitmap(String avatarUrl) {
        try {
            URL url = new URL(avatarUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            if (conn.getResponseCode() != 200) return;
            Bitmap bitmap;
            try (InputStream is = conn.getInputStream()) {
                bitmap = BitmapFactory.decodeStream(is);
            }
            if (bitmap == null) return;
            Bitmap finalBitmap = bitmap;
            handler.post(() -> {
                if (avatarImage == null) return;
                RoundedBitmapDrawable rounded = RoundedBitmapDrawableFactory.create(getResources(), finalBitmap);
                rounded.setCircular(true);
                avatarImage.setImageDrawable(rounded);
                avatarImage.setVisibility(View.VISIBLE);
            });
        } catch (Exception ignored) {}
    }

    // Deliberately minimal — avoids pulling in a JSON library dependency for
    // reading a couple of known fields. Not a general-purpose JSON parser.
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

    // calleeUsername is THIS device's own username (the person declining) —
    // see the EXTRA_CALLEE comment above for why this must not be
    // callerUsername. Guarded for null defensively in case an older/newer
    // client-server pairing is ever mismatched mid-rollout; in the normal
    // case (matching backend + app build) it's always present.
    private void decline() {
        stopRinging();
        if (calleeUsername != null) postDecline(callId, calleeUsername);
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
