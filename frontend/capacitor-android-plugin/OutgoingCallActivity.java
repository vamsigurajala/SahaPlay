package com.sahaplay.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

// "Calling..." screen shown to the CALLER while a native call rings —
// launched by CallEngineService.startCall(). Same plain-Views-no-XML-layout
// approach as IncomingCallActivity (no way to iterate on a real layout
// resource without a device in this environment), and reuses that file's
// initials-avatar-bitmap builder for visual consistency between the two
// ring screens.
//
// Finishes itself the instant the call becomes active — CallEngineService
// already launches ActiveCallActivity directly once answered (see
// onCallActive below), this screen has no work left to do at that point.
public class OutgoingCallActivity extends android.app.Activity implements CallEngineService.CallUiListener {
    private static final String TAG = "SahaplayOutgoingCall";
    private static final String API_BASE = "https://sahaplay.com";

    public static final String EXTRA_CALL_ID = "callId";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private TextView nameLabel;
    private ImageView avatarImage;
    private boolean finishedForCallEnd = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        callId = getIntent().getStringExtra(EXTRA_CALL_ID);
        CallEngineService engine = CallEngineService.get(this);
        CallSession session = engine.getSession();

        if (callId == null || session == null || !callId.equals(session.callId)) {
            // The call already ended (declined/busy/etc.) before this
            // Activity's onCreate() even ran — a real possibility given the
            // network round trip startCall() kicks off. Nothing to show.
            finish();
            return;
        }

        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        engine.setUiListener(this);

        boolean isVideo = "video".equals(session.callType);
        buildUi(session.peerUsername, session.peerDisplayName, isVideo);
        if (session.peerAvatarUrl != null && !session.peerAvatarUrl.isEmpty()) {
            String avatarUrl = session.peerAvatarUrl.startsWith("http") ? session.peerAvatarUrl : (API_BASE + session.peerAvatarUrl);
            new Thread(() -> fetchAndSetAvatarBitmap(avatarUrl)).start();
        } else {
            fetchCallerDetailsFallback(session.peerUsername);
        }
    }

    private void buildUi(String username, String displayName, boolean isVideo) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#0B0F1A"));
        root.setPadding(dp(24), dp(72), dp(24), dp(48));

        root.addView(new LinearLayout(this), new LinearLayout.LayoutParams(0, 0, 1f));

        int avatarSize = dp(112);
        FrameLayout avatarFrame = new FrameLayout(this);
        root.addView(avatarFrame, new LinearLayout.LayoutParams(avatarSize, avatarSize));

        View avatarBg = new View(this);
        GradientDrawable avatarBgDrawable = new GradientDrawable();
        avatarBgDrawable.setShape(GradientDrawable.OVAL);
        avatarBgDrawable.setColor(Color.parseColor(colorForUsername(username)));
        avatarBg.setBackground(avatarBgDrawable);
        avatarFrame.addView(avatarBg, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        TextView initials = new TextView(this);
        initials.setText(initialsFor(username));
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
        nameLabel.setText(displayName);
        nameLabel.setTextColor(Color.WHITE);
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        nameLabel.setTypeface(nameLabel.getTypeface(), Typeface.BOLD);
        nameLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nameParams.topMargin = dp(20);
        root.addView(nameLabel, nameParams);

        TextView subLabel = new TextView(this);
        subLabel.setText(isVideo ? "Calling (video)…" : "Calling…");
        subLabel.setTextColor(Color.parseColor("#9CA3AF"));
        subLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        subLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subParams.topMargin = dp(6);
        root.addView(subLabel, subParams);

        root.addView(new LinearLayout(this), new LinearLayout.LayoutParams(0, 0, 1.4f));

        LinearLayout cancelCol = new LinearLayout(this);
        cancelCol.setOrientation(LinearLayout.VERTICAL);
        cancelCol.setGravity(Gravity.CENTER_HORIZONTAL);

        int btnSize = dp(62);
        ImageView cancelBtn = new ImageView(this);
        cancelBtn.setImageResource(R.drawable.ic_call_decline);
        cancelBtn.setScaleType(ImageView.ScaleType.CENTER);
        int iconPad = dp(18);
        cancelBtn.setPadding(iconPad, iconPad, iconPad, iconPad);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setShape(GradientDrawable.OVAL);
        btnBg.setColor(Color.parseColor("#EF4444"));
        cancelBtn.setBackground(btnBg);
        cancelBtn.setOnClickListener(v -> { CallEngineService.get(this).endCall(); finish(); });
        cancelCol.addView(cancelBtn, new LinearLayout.LayoutParams(btnSize, btnSize));

        TextView cancelLabel = new TextView(this);
        cancelLabel.setText("Cancel");
        cancelLabel.setTextColor(Color.parseColor("#B3B3B3"));
        cancelLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        cancelLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = dp(8);
        cancelCol.addView(cancelLabel, labelParams);

        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setGravity(Gravity.CENTER);
        buttonRow.addView(cancelCol);
        root.addView(buttonRow, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0));

        setContentView(root);
    }

    // Best-effort refresh when startCall() wasn't given a peerAvatarUrl at
    // all (e.g. an older JS build) — same GET /api/users/:username +
    // User-Agent hardening pattern IncomingCallActivity uses.
    private void fetchCallerDetailsFallback(String username) {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/users/" + Uri.encode(username));
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "SahaPlay-Android");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                if (conn.getResponseCode() != 200) return;
                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }
                String avatarPath = extractJsonStringField(sb.toString(), "avatarPath");
                if (avatarPath == null || avatarPath.isEmpty()) return;
                String avatarUrl = avatarPath.startsWith("http") ? avatarPath : (API_BASE + avatarPath);
                fetchAndSetAvatarBitmap(avatarUrl);
            } catch (Exception e) {
                Log.w(TAG, "fetchCallerDetailsFallback failed", e);
            }
        }).start();
    }

    private void fetchAndSetAvatarBitmap(String avatarUrl) {
        try {
            URL url = new URL(avatarUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("User-Agent", "SahaPlay-Android");
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
        } catch (Exception e) {
            Log.w(TAG, "fetchAndSetAvatarBitmap failed for " + avatarUrl, e);
        }
    }

    private static String extractJsonStringField(String json, String field) {
        String marker = "\"" + field + "\"";
        int idx = json.indexOf(marker);
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx + marker.length());
        if (colon < 0) return null;
        int i = colon + 1;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= json.length() || json.charAt(i) != '"') return null;
        int startQuote = i;
        int endQuote = startQuote + 1;
        while (endQuote < json.length() && json.charAt(endQuote) != '"') {
            if (json.charAt(endQuote) == '\\') endQuote++;
            endQuote++;
        }
        if (endQuote >= json.length()) return null;
        return json.substring(startQuote + 1, endQuote).replace("\\\"", "\"");
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

    // ─── CallEngineService.CallUiListener ───

    @Override public void onRemoteVideoTrack(org.webrtc.VideoTrack track) {
        // Nothing to render here — ActiveCallActivity (already launched by
        // CallEngineService the moment the call became active) owns video
        // rendering from this point on.
    }

    @Override public void onCallActive() {
        // CallEngineService already launched ActiveCallActivity directly —
        // this screen's only job left is to get out of the way.
        handler.post(this::finish);
    }

    @Override public void onCallEnded(String reason) {
        if (finishedForCallEnd) return;
        finishedForCallEnd = true;
        handler.post(() -> {
            String message = "declined".equals(reason) ? "Call declined"
                : "busy".equals(reason) ? "They're on another call"
                : "timeout".equals(reason) ? "No answer"
                : null;
            if (message != null) Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
            finish();
        });
    }

    @Override public void onRemoteState(boolean micOn, boolean camOn) {
        // Not shown on this screen — the call hasn't connected yet.
    }

    @Override
    protected void onDestroy() {
        CallEngineService.get(this).clearUiListener(this);
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
