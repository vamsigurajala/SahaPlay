package com.sahaplay.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

import org.webrtc.RendererCommon;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoTrack;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

// The real live-call screen — mute/speaker/camera/end, matching
// OneOnOneCallScreen.jsx's own layout (top bar with name+timer, full-bleed
// video or a centered avatar, bottom control dock) closely enough that the
// native and web/JS call screens read as the same design. Launched by
// CallEngineService.acceptIncomingCall() (optimistically, the instant
// Answer is tapped) or .onCallAnswered() (the caller, once the callee
// accepts) — never launched directly by anything else, so getSession()
// should always have a live, matching CallSession by the time onCreate()
// runs; if it doesn't (the call already ended in the race before this
// Activity got to run), this just finishes immediately.
//
// SurfaceViewRenderer lifecycle is the trickiest part of this file (see the
// plan doc's own flagged risk on this) — init()/release() are paired
// exactly once per Activity instance in onCreate()/onDestroy(), and
// addSink()/removeSink() are used (not re-init) whenever the underlying
// VideoTrack changes, since a VideoTrack can arrive after this Activity is
// already showing (see onLocalVideoTrack/onRemoteVideoTrack below).
public class ActiveCallActivity extends android.app.Activity implements CallEngineService.CallUiListener {
    private static final String TAG = "SahaplayActiveCall";
    private static final String API_BASE = "https://sahaplay.com";

    public static final String EXTRA_CALL_ID = "callId";
    // Set only by IncomingCallActivity's notification-Answer PendingIntent
    // (see buildAnswerPendingIntent there) — this Activity accepts the call
    // itself via CallEngineService BEFORE reading getSession(), rather than
    // relying on IncomingCallActivity or SahaplayConnection to have already
    // done it. Absent (false) for the normal path, where CallEngineService
    // itself already called acceptIncomingCall()/launched this Activity by
    // the time onCreate() runs.
    public static final String EXTRA_ANSWER_NOW = "answerNow";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private boolean isVideo;
    private boolean finishedForCallEnd = false;

    // ─── Views ───
    private FrameLayout root;
    private SurfaceViewRenderer remoteRenderer;
    private SurfaceViewRenderer localRenderer;
    private View avatarLayer;
    private ImageView avatarImage;
    private TextView avatarInitials;
    private TextView nameLabel;
    private TextView timerLabel;
    private ImageView micBtn;
    private ImageView camBtn;
    private ImageView routeBtn;
    private TextView routeLabel;
    private LinearLayout routeSheet;
    private VideoTrack attachedRemoteTrack;
    private VideoTrack attachedLocalTrack;

    private String audioRoute = "earpiece"; // 'earpiece' | 'speaker' | 'bluetooth'
    private final Runnable timerTick = new Runnable() {
        @Override public void run() {
            updateTimerLabel();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        callId = getIntent().getStringExtra(EXTRA_CALL_ID);
        CallEngineService engine = CallEngineService.get(this);

        if (callId != null && getIntent().getBooleanExtra(EXTRA_ANSWER_NOW, false)) {
            // Tapped Answer on the heads-up/tray notification directly —
            // accept the call ourselves before reading session state below.
            // acceptIncomingCall() itself calls back into
            // launchActiveCallActivity(), which just re-targets this same
            // singleInstance Activity (see the manifest) rather than
            // stacking a second one.
            engine.acceptIncomingCall(callId);
        }

        CallSession session = engine.getSession();

        if (callId == null || session == null || !callId.equals(session.callId)) {
            finish();
            return;
        }

        showOverLockScreen();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Voice calls start on the earpiece, video calls start on speaker —
        // matches CallContext.jsx's own WhatsApp-style default (you're
        // usually holding the phone up to look at the screen, not your ear,
        // for a video call).
        isVideo = "video".equals(session.callType);
        audioRoute = isVideo ? "speaker" : "earpiece";
        AudioRouteController.setRoute(this, audioRoute);

        engine.setUiListener(this);
        buildUi(session);
        fetchPeerAvatarIfNeeded(session);

        // Pick up state that may have already arrived before this Activity
        // registered as the listener (see CallEngineService.getSession()'s
        // own comment on this exact race).
        if (session.localVideoTrack != null) onLocalVideoTrack(session.localVideoTrack);
        if (session.remoteVideoTrack != null) onRemoteVideoTrack(session.remoteVideoTrack);
        onRemoteState(session.remoteMicOn, session.remoteCamOn);
        updateMicButton(engine.isMicOn());
        updateCamButton(engine.isCamOn());

        handler.post(timerTick);
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
    }

    // ─── UI construction ───

    private void buildUi(CallSession session) {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B0F1A"));

        buildVideoLayer();
        buildAvatarLayer(session);
        buildTopBar(session);
        buildDock();

        setContentView(root);
    }

    private void buildVideoLayer() {
        org.webrtc.EglBase.Context eglContext = CallEngineService.get(this).getEglContext();

        remoteRenderer = new SurfaceViewRenderer(this);
        if (eglContext != null) remoteRenderer.init(eglContext, null);
        remoteRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL);
        remoteRenderer.setZOrderMediaOverlay(false);
        remoteRenderer.setVisibility(View.GONE);
        root.addView(remoteRenderer, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        localRenderer = new SurfaceViewRenderer(this);
        if (eglContext != null) localRenderer.init(eglContext, null);
        localRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL);
        localRenderer.setZOrderMediaOverlay(true);
        localRenderer.setMirror(CallEngineService.get(this).isFrontFacingCamera());
        localRenderer.setVisibility(View.GONE);
        // Small PiP, bottom-right — matches OneOnOneCallScreen.jsx's .ooc-pip
        // (128x176dp there; same aspect here).
        FrameLayout.LayoutParams pipParams = new FrameLayout.LayoutParams(dp(112), dp(154));
        pipParams.gravity = Gravity.TOP | Gravity.END;
        pipParams.topMargin = dp(96);
        pipParams.rightMargin = dp(16);
        localRenderer.setOnClickListener(v -> CallEngineService.get(this).flipCamera());
        root.addView(localRenderer, pipParams);
    }

    // Shown instead of the remote video layer for a voice call, or a video
    // call before the remote side's video track/camera is actually on —
    // mirrors OneOnOneCallScreen.jsx's SoloStage avatar fallback.
    private void buildAvatarLayer(CallSession session) {
        FrameLayout layer = new FrameLayout(this);
        layer.setLayoutParams(new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        layer.setGravity(Gravity.CENTER);
        avatarLayer = layer;

        int avatarSize = dp(112);
        FrameLayout avatarFrame = new FrameLayout(this);
        FrameLayout.LayoutParams frameParams = new FrameLayout.LayoutParams(avatarSize, avatarSize);
        frameParams.gravity = Gravity.CENTER;
        layer.addView(avatarFrame, frameParams);

        View avatarBg = new View(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor(colorForUsername(session.peerUsername)));
        avatarBg.setBackground(bg);
        avatarFrame.addView(avatarBg, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        avatarInitials = new TextView(this);
        avatarInitials.setText(initialsFor(session.peerUsername));
        avatarInitials.setTextColor(Color.WHITE);
        avatarInitials.setTextSize(TypedValue.COMPLEX_UNIT_SP, 36);
        avatarInitials.setTypeface(avatarInitials.getTypeface(), Typeface.BOLD);
        avatarInitials.setGravity(Gravity.CENTER);
        avatarFrame.addView(avatarInitials, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        avatarImage = new ImageView(this);
        avatarImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatarImage.setVisibility(View.GONE);
        avatarFrame.addView(avatarImage, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        root.addView(layer);
    }

    private void buildTopBar(CallSession session) {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.VERTICAL);
        bar.setGravity(Gravity.CENTER_HORIZONTAL);
        bar.setBackgroundColor(Color.parseColor("#88000000"));
        int topPad = dp(14) + statusBarInset();
        bar.setPadding(dp(16), topPad, dp(16), dp(16));

        nameLabel = new TextView(this);
        nameLabel.setText(session.peerDisplayName);
        nameLabel.setTextColor(Color.WHITE);
        nameLabel.setTypeface(nameLabel.getTypeface(), Typeface.BOLD);
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        nameLabel.setGravity(Gravity.CENTER);
        bar.addView(nameLabel);

        timerLabel = new TextView(this);
        timerLabel.setText(isVideo ? "Video call" : "Voice call");
        timerLabel.setTextColor(Color.parseColor("#B3B7C2"));
        timerLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        timerLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams timerParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        timerParams.topMargin = dp(2);
        bar.addView(timerLabel, timerParams);

        FrameLayout.LayoutParams barParams = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        barParams.gravity = Gravity.TOP;
        root.addView(bar, barParams);
    }

    private void buildDock() {
        LinearLayout dockBox = new LinearLayout(this);
        dockBox.setOrientation(LinearLayout.HORIZONTAL);
        dockBox.setGravity(Gravity.CENTER);
        GradientDrawable dockBg = new GradientDrawable();
        dockBg.setColor(Color.parseColor("#8C141414"));
        dockBg.setCornerRadius(dp(28));
        dockBox.setBackground(dockBg);
        dockBox.setPadding(dp(14), dp(10), dp(14), dp(10));

        routeBtn = iconOnly(routeIconRes());
        routeBtn.setOnClickListener(v -> {
            // Short tap: instantly toggle speaker on/off — the common case.
            String next = "speaker".equals(audioRoute) ? "earpiece" : "speaker";
            setAudioRouteAndRefresh(next);
        });
        routeBtn.setOnLongClickListener(v -> { showRouteSheet(); return true; });
        routeLabel = new TextView(this);
        routeLabel.setText(routeLabelText());
        dockBox.addView(dockColumn(routeBtn, routeLabel), dockButtonParams());

        if (isVideo) {
            camBtn = iconOnly(R.drawable.ic_call_answer);
            camBtn.setOnClickListener(v -> {
                CallEngineService.get(this).toggleCam();
                updateCamButton(CallEngineService.get(this).isCamOn());
            });
            TextView camLabel = new TextView(this);
            camLabel.setText("Video");
            styleDockLabel(camLabel);
            dockBox.addView(dockColumn(camBtn, camLabel), dockButtonParams());
        }

        micBtn = iconOnly(R.drawable.ic_call_answer);
        micBtn.setOnClickListener(v -> {
            CallEngineService.get(this).toggleMic();
            updateMicButton(CallEngineService.get(this).isMicOn());
        });
        TextView micLabel = new TextView(this);
        micLabel.setText("Mute");
        styleDockLabel(micLabel);
        dockBox.addView(dockColumn(micBtn, micLabel), dockButtonParams());

        ImageView endBtn = iconOnly(R.drawable.ic_call_decline);
        GradientDrawable endBg = new GradientDrawable();
        endBg.setShape(GradientDrawable.OVAL);
        endBg.setColor(Color.parseColor("#EF4444"));
        endBtn.setBackground(endBg);
        int endPad = dp(14);
        endBtn.setPadding(endPad, endPad, endPad, endPad);
        endBtn.setOnClickListener(v -> { CallEngineService.get(this).endCall(); finish(); });
        TextView endLabel = new TextView(this);
        endLabel.setText("End");
        styleDockLabel(endLabel);
        dockBox.addView(dockColumn(endBtn, endLabel), dockButtonParams());

        FrameLayout.LayoutParams dockParams = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        dockParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        dockParams.bottomMargin = dp(28) + navBarInset();
        root.addView(dockBox, dockParams);

        // ─── Route picker sheet (long-press the speaker button) ───
        routeSheet = new LinearLayout(this);
        routeSheet.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable sheetBg = new GradientDrawable();
        sheetBg.setColor(Color.parseColor("#F7181A24"));
        sheetBg.setCornerRadius(dp(16));
        routeSheet.setBackground(sheetBg);
        routeSheet.setPadding(dp(6), dp(6), dp(6), dp(6));
        routeSheet.setVisibility(View.GONE);
        routeSheet.addView(routeSheetOption("Normal", "earpiece"));
        routeSheet.addView(routeSheetOption("Speaker", "speaker"));
        if (AudioRouteController.isBluetoothAudioAvailable(this)) {
            routeSheet.addView(routeSheetOption("Bluetooth", "bluetooth"));
        }
        FrameLayout.LayoutParams sheetParams = new FrameLayout.LayoutParams(dp(190), FrameLayout.LayoutParams.WRAP_CONTENT);
        sheetParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        // Clears the dock (matches the same overlap fix applied to
        // OneOnOneCallScreen.jsx's own route sheet — see that file's
        // .ooc-route-sheet comment).
        sheetParams.bottomMargin = dp(128) + navBarInset();
        root.addView(routeSheet, sheetParams);

        // Tapping anywhere else closes an open sheet.
        root.setOnClickListener(v -> hideRouteSheet());
    }

    private View routeSheetOption(String label, String route) {
        TextView opt = new TextView(this);
        opt.setText(label);
        opt.setTextColor(Color.WHITE);
        opt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        opt.setPadding(dp(16), dp(12), dp(16), dp(12));
        opt.setOnClickListener(v -> { setAudioRouteAndRefresh(route); hideRouteSheet(); });
        return opt;
    }

    private void showRouteSheet() { if (routeSheet != null) routeSheet.setVisibility(View.VISIBLE); }
    private void hideRouteSheet() { if (routeSheet != null) routeSheet.setVisibility(View.GONE); }

    private void setAudioRouteAndRefresh(String route) {
        audioRoute = route;
        AudioRouteController.setRoute(this, route);
        if (routeBtn != null) routeBtn.setImageResource(routeIconRes());
        if (routeLabel != null) routeLabel.setText(routeLabelText());
    }

    private int routeIconRes() {
        // Reuses the existing answer/decline drawables as stand-ins — a
        // dedicated speaker/bluetooth icon set wasn't part of this asset
        // pack; visually distinct enough (green vs red-styled backgrounds
        // aren't used here, just the glyph) not to be confused with the
        // call-control meaning those drawables carry elsewhere.
        return R.drawable.ic_call_answer;
    }

    private String routeLabelText() {
        return "bluetooth".equals(audioRoute) ? "Bluetooth" : "speaker".equals(audioRoute) ? "Speaker" : "Normal";
    }

    private LinearLayout dockColumn(View button, TextView label) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.addView(button, new LinearLayout.LayoutParams(dp(50), dp(50)));
        styleDockLabel(label);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = dp(6);
        col.addView(label, labelParams);
        return col;
    }

    private void styleDockLabel(TextView label) {
        label.setTextColor(Color.parseColor("#B3B7C2"));
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.5f);
        label.setGravity(Gravity.CENTER);
    }

    private ImageView iconOnly(int drawableRes) {
        ImageView iv = new ImageView(this);
        iv.setImageResource(drawableRes);
        iv.setScaleType(ImageView.ScaleType.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#24FFFFFF"));
        iv.setBackground(bg);
        int pad = dp(12);
        iv.setPadding(pad, pad, pad, pad);
        return iv;
    }

    private LinearLayout.LayoutParams dockButtonParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(10), 0, dp(10), 0);
        return p;
    }

    // ─── Timer ───

    private void updateTimerLabel() {
        CallSession cs = CallEngineService.get(this).getSession();
        if (cs == null || cs.answeredAt <= 0 || timerLabel == null) return;
        long secs = (System.currentTimeMillis() - cs.answeredAt) / 1000;
        long m = secs / 60, s = secs % 60;
        timerLabel.setText(String.format(java.util.Locale.US, "%d:%02d", m, s));
    }

    // ─── Avatar/name fetch ───

    private void fetchPeerAvatarIfNeeded(CallSession session) {
        if (session.peerAvatarUrl != null && !session.peerAvatarUrl.isEmpty()) {
            String avatarUrl = session.peerAvatarUrl.startsWith("http") ? session.peerAvatarUrl : (API_BASE + session.peerAvatarUrl);
            new Thread(() -> fetchAndSetAvatarBitmap(avatarUrl)).start();
            return;
        }
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/users/" + Uri.encode(session.peerUsername));
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
                fetchAndSetAvatarBitmap(avatarPath.startsWith("http") ? avatarPath : (API_BASE + avatarPath));
            } catch (Exception e) {
                Log.w(TAG, "fetchPeerAvatarIfNeeded fallback failed", e);
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

    // ─── Button state ───

    private void updateMicButton(boolean micOn) {
        if (micBtn == null) return;
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor(micOn ? "#24FFFFFF" : "#EF4444"));
        micBtn.setBackground(bg);
        int pad = dp(12);
        micBtn.setPadding(pad, pad, pad, pad);
    }

    private void updateCamButton(boolean camOn) {
        if (camBtn == null) return;
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor(camOn ? "#4DA8FF" : "#24FFFFFF"));
        camBtn.setBackground(bg);
        int pad = dp(12);
        camBtn.setPadding(pad, pad, pad, pad);
        if (localRenderer != null) localRenderer.setVisibility(camOn && attachedLocalTrack != null ? View.VISIBLE : View.GONE);
    }

    // Shows the remote video layer only when there's an actual track AND
    // the remote side currently has their camera on — a disabled remote
    // track (their own toggleCam(false)) still technically exists on this
    // end, it just stops producing new frames, which without this check
    // would freeze on their last visible frame instead of falling back to
    // the avatar like OneOnOneCallScreen.jsx's own r.hasVideo check does.
    private void refreshRemoteVisibility(boolean remoteCamOn) {
        boolean showVideo = isVideo && attachedRemoteTrack != null && remoteCamOn;
        if (remoteRenderer != null) remoteRenderer.setVisibility(showVideo ? View.VISIBLE : View.GONE);
        if (avatarLayer != null) avatarLayer.setVisibility(showVideo ? View.GONE : View.VISIBLE);
    }

    // ─── Helpers ───

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

    private int statusBarInset() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : dp(24);
    }

    private int navBarInset() {
        int id = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    // ─── CallEngineService.CallUiListener ───

    @Override public void onLocalVideoTrack(VideoTrack track) {
        handler.post(() -> {
            if (localRenderer == null || track == attachedLocalTrack) return;
            if (attachedLocalTrack != null) attachedLocalTrack.removeSink(localRenderer);
            attachedLocalTrack = track;
            track.addSink(localRenderer);
            localRenderer.setMirror(CallEngineService.get(this).isFrontFacingCamera());
            updateCamButton(CallEngineService.get(this).isCamOn());
        });
    }

    @Override public void onRemoteVideoTrack(VideoTrack track) {
        handler.post(() -> {
            if (remoteRenderer == null || track == attachedRemoteTrack) return;
            if (attachedRemoteTrack != null) attachedRemoteTrack.removeSink(remoteRenderer);
            attachedRemoteTrack = track;
            track.addSink(remoteRenderer);
            CallSession cs = CallEngineService.get(this).getSession();
            refreshRemoteVisibility(cs != null && cs.remoteCamOn);
        });
    }

    @Override public void onCallActive() {
        // Already active by the time this Activity exists — nothing to do.
    }

    @Override public void onCallEnded(String reason) {
        if (finishedForCallEnd) return;
        finishedForCallEnd = true;
        handler.post(() -> {
            Toast.makeText(this, "Call ended", Toast.LENGTH_SHORT).show();
            finish();
        });
    }

    @Override public void onRemoteState(boolean micOn, boolean camOn) {
        handler.post(() -> refreshRemoteVisibility(camOn));
    }

    @Override
    protected void onDestroy() {
        CallEngineService.get(this).clearUiListener(this);
        handler.removeCallbacksAndMessages(null);
        if (attachedLocalTrack != null && localRenderer != null) attachedLocalTrack.removeSink(localRenderer);
        if (attachedRemoteTrack != null && remoteRenderer != null) attachedRemoteTrack.removeSink(remoteRenderer);
        if (localRenderer != null) { try { localRenderer.release(); } catch (Exception ignored) {} }
        if (remoteRenderer != null) { try { remoteRenderer.release(); } catch (Exception ignored) {} }
        // The call itself keeps running in the background (SahaplayCallService's
        // notification stays up) unless the user explicitly tapped End —
        // finishing this Activity (e.g. pressing Home mid-call) must NOT
        // also hang up, matching every mainstream calling app.
        super.onDestroy();
    }
}
