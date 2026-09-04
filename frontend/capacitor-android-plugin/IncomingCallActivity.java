package com.sahaplay.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
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
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
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
// LinearLayout/TextView/ImageView composition keeps this understandable
// without one. (The one exception is the notification's OWN content view,
// which has to be a real XML layout — see res/layout/notification_incoming_
// call.xml — RemoteViews can't inflate a programmatic view tree.)
//
// Launched two ways: SahaplayFirebaseMessagingService.showIncomingCall()
// when a call-type FCM data message arrives (app backgrounded/killed), or
// directly by tapping the notification body. Decline posts straight to
// POST /api/calls/:callId/decline (see backend/server.js) over plain HTTPS —
// no JWT needed, this activity may be running with the app process
// otherwise fully dead, so there is no live socket or JS context to route
// the action through. Answer instead hands off to the already-running (or
// freshly launched) web app via the sahaplay://call-answer deep link (see
// AndroidManifest.xml's intent-filter + frontend/src/lib/nativeCallBridge.js)
// — accepting a call needs real getUserMedia/WebRTC, which only exists
// inside the WebView/JS layer.
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
    // CALLER's username in that field instead — the backend could never
    // match that against anything, so the POST silently 404'd and nothing
    // happened for either side.
    public static final String EXTRA_CALLEE = "calleeUsername";
    public static final String EXTRA_CALL_TYPE = "callType";
    // Carried straight from the FCM push payload (see backend/server.js's
    // call:invite handler) so the very first notification/ring-screen paint
    // can already have the real name/photo — no network round-trip, no race.
    // Previously this Activity only ever learned the caller's display name/
    // avatar by making its OWN GET /api/users/:username call after showing
    // initials first; that fetch reliably finished in time for the full
    // ring screen (the user takes a second or two to look at it) but NOT for
    // the heads-up notification banner, which many people glance at and tap
    // Answer on within a second — faster than the round trip could complete,
    // so it was still showing initials by the time anyone actually saw it.
    // These extras are optional/best-effort — the existing fetch (see
    // fetchCallerDetails/fetchAndRefreshNotificationAvatar below) still runs
    // regardless, as a fallback for older pushes and a refresh if the value
    // sent with the push was stale.
    public static final String EXTRA_CALLER_DISPLAY_NAME = "callerDisplayName";
    public static final String EXTRA_CALLER_AVATAR_PATH = "callerAvatarPath";
    // Set by CallActionReceiver's ACTION_ANSWER_PING branch when the user
    // tapped "Answer" directly on the compact notification/lock-screen
    // action (not this Activity's own full ring screen) — the more common
    // real-world tap target. Launching this Activity in that case (instead
    // of firing the sahaplay://call-answer deep link straight from the
    // BroadcastReceiver) means the user sees this screen's native
    // "Connecting…" state immediately, with no blank gap while the
    // WebView-based MainActivity cold-starts underneath — see
    // onAnswerTapped's own comment for the full reasoning.
    public static final String EXTRA_AUTO_ANSWER = "autoAnswer";

    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private String callerUsername;
    private String calleeUsername;

    // Builds and shows the incoming-call notification. Safe to call from any
    // thread/context — used both from the FCM service (background/killed
    // app) and could be reused elsewhere if ever needed.
    //
    // Three distinct tap targets, matching what each one should actually do:
    //  - Notification BODY -> opens this Activity's full ring screen
    //    (avatar + Decline/Answer), for whoever wants to see who's calling
    //    before deciding.
    //  - The notification's OWN "Decline" button acts entirely in the
    //    background via CallActionReceiver — no Activity, the app is never
    //    opened/resumed at all, matching WhatsApp/Telegram's own
    //    notification-action behavior (a getActivity() PendingIntent here,
    //    even one that finishes itself instantly, still briefly resumes the
    //    app first, which read as "tapping Decline opened the app").
    //  - The notification's OWN "Answer" button goes straight to the
    //    sahaplay://call-answer hand-off the in-Activity Answer button uses
    //    — answering genuinely needs the WebView (real getUserMedia/
    //    RTCPeerConnection), so opening the app is unavoidable there, but at
    //    least with NO intermediate ring-screen prompt in between (that used
    //    to reopen this same Activity — the "how many times do I have to
    //    click Answer" bug).
    public static void showIncomingCall(Context ctx, String callId, String callerUsername, String callType, String calleeUsername) {
        showIncomingCall(ctx, callId, callerUsername, callType, calleeUsername, null, null);
    }

    public static void showIncomingCall(Context ctx, String callId, String callerUsername, String callType, String calleeUsername,
            String callerDisplayName, String callerAvatarPath) {
        if (callId == null || callerUsername == null) return;
        boolean isVideo = "video".equals(callType);
        String displayName = (callerDisplayName != null && !callerDisplayName.isEmpty()) ? callerDisplayName : callerUsername;

        Intent fullScreenIntent = new Intent(ctx, IncomingCallActivity.class);
        fullScreenIntent.putExtra(EXTRA_CALL_ID, callId);
        fullScreenIntent.putExtra(EXTRA_CALLER, callerUsername);
        fullScreenIntent.putExtra(EXTRA_CALL_TYPE, callType);
        fullScreenIntent.putExtra(EXTRA_CALLEE, calleeUsername);
        fullScreenIntent.putExtra(EXTRA_CALLER_DISPLAY_NAME, callerDisplayName);
        fullScreenIntent.putExtra(EXTRA_CALLER_AVATAR_PATH, callerAvatarPath);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(ctx, callId.hashCode(), fullScreenIntent, piFlags);

        Intent declineIntent = new Intent(ctx, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE);
        declineIntent.putExtra(CallActionReceiver.EXTRA_CALL_ID, callId);
        declineIntent.putExtra(CallActionReceiver.EXTRA_USERNAME, calleeUsername);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(ctx, callId.hashCode() ^ 1, declineIntent, piFlags);

        PendingIntent answerPendingIntent = buildAnswerPendingIntent(ctx, callId, callerUsername, callType, calleeUsername, callerDisplayName, callerAvatarPath, piFlags);

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

        // NotificationCompat.CallStyle — the real, first-party Android API
        // for exactly this (WhatsApp/Telegram-style incoming-call
        // notifications: avatar circle, caller name, colored full-width
        // Decline/Answer pills), rendered entirely by the OS itself.
        // Replaces an earlier hand-rolled RemoteViews layout (custom XML +
        // pill-shaped drawables + a manually-drawn avatar Bitmap) that
        // looked right in review but rendered inconsistently across real
        // devices/OEM skins — some showed a plain system-default layout
        // instead of the custom view at all. CallStyle is a first-party,
        // OS-tested API that doesn't have that class of problem, and
        // gracefully degrades to a big-style two-button notification on
        // pre-Android-12 devices instead of failing silently.
        Person callerPerson = new Person.Builder()
            .setName(displayName)
            .setIcon(IconCompat.createWithBitmap(buildInitialsAvatarBitmap(callerUsername, 156)))
            .setImportant(true)
            .build();
        NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forIncomingCall(
            callerPerson, declinePendingIntent, answerPendingIntent
        );

        Notification notification = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setContentTitle(displayName)
            .setContentText(isVideo ? "Incoming video call" : "Incoming voice call")
            .setSmallIcon(ctx.getApplicationInfo().icon)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            // Without this, NotificationCompat defaults to VISIBILITY_PRIVATE
            // — on a secure lock screen with "hide sensitive content"
            // enabled (a common default on many OEM skins, e.g. MIUI), that
            // redacts this notification down to a bare "New notification"
            // with NO action buttons at all while locked, so tapping where
            // Decline should be does nothing. A ringing call's actions need
            // to work from the lock screen the same way WhatsApp/Telegram's
            // do, so this is forced public regardless of that setting — the
            // notification body (caller name) is the only thing it exposes.
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setStyle(callStyle)
            .setAutoCancel(true)
            .setOngoing(true)
            .build();

        nm.notify(callId.hashCode(), notification);

        // Swaps in the caller's real photo once it's loaded — showing only
        // the instant-available initials placeholder above is deliberate
        // (a network round-trip would delay the notification itself), but
        // there's no reason to leave it on initials forever once the real
        // photo is one cheap GET away. Re-posting a notification with the
        // same ID replaces it in place, same as WhatsApp/Telegram swapping
        // in a real photo shortly after their own initial ring notification.
        // callerAvatarPath (from the FCM push) skips straight to fetching the
        // image itself when present — no need to re-fetch the profile first
        // just to learn a URL that's already in hand; see this method's own
        // comment for why that extra round trip mattered for a heads-up
        // banner specifically.
        fetchAndRefreshNotificationAvatar(ctx, callId, callerUsername, displayName, callerAvatarPath, isVideo, declinePendingIntent, answerPendingIntent, fullScreenPendingIntent);
    }

    private static void fetchAndRefreshNotificationAvatar(Context ctx, String callId, String callerUsername, String displayName,
            String knownAvatarPath, boolean isVideo,
            PendingIntent declinePendingIntent, PendingIntent answerPendingIntent, PendingIntent fullScreenPendingIntent) {
        new Thread(() -> {
            try {
                String avatarPath = knownAvatarPath;
                if (avatarPath == null) {
                    // Fallback path — no avatarPath came with the push (e.g. an
                    // older server build), so fetch the profile first to learn
                    // one, same as before this optimization existed.
                    URL url = new URL(API_BASE + "/api/users/" + Uri.encode(callerUsername));
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    // See the matching comment in fetchCallerDetails() — same
                    // request, called from the notification path instead of the
                    // full-screen ring Activity, so it needs the same hardening.
                    conn.setRequestProperty("User-Agent", "SahaPlay-Android");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    int code = conn.getResponseCode();
                    if (code != 200) {
                        Log.w("SahaplayIncomingCall", "fetchAndRefreshNotificationAvatar: GET " + url + " -> " + code);
                        return;
                    }
                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                    }
                    avatarPath = extractJsonStringField(sb.toString(), "avatarPath");
                }
                if (avatarPath == null || avatarPath.isEmpty()) return;
                String avatarUrl = avatarPath.startsWith("http") ? avatarPath : (API_BASE + avatarPath);
                HttpURLConnection imgConn = (HttpURLConnection) new URL(avatarUrl).openConnection();
                imgConn.setRequestProperty("User-Agent", "SahaPlay-Android");
                imgConn.setConnectTimeout(5000);
                imgConn.setReadTimeout(5000);
                int imgCode = imgConn.getResponseCode();
                if (imgCode != 200) {
                    Log.w("SahaplayIncomingCall", "fetchAndRefreshNotificationAvatar: GET " + avatarUrl + " -> " + imgCode);
                    return;
                }
                Bitmap photo;
                try (InputStream is = imgConn.getInputStream()) {
                    photo = BitmapFactory.decodeStream(is);
                }
                if (photo == null) return;

                // No explicit "is this call still ringing" check needed here:
                // if it was already resolved, cancelForCallId() already
                // cancelled this notification ID outright, so re-notify()ing
                // it here would just silently resurrect a very short-lived,
                // already-inert notification — a harmless, rare edge case,
                // not worth the extra state tracking to prevent.
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                Person callerPerson = new Person.Builder()
                    .setName(displayName)
                    .setIcon(IconCompat.createWithBitmap(photo))
                    .setImportant(true)
                    .build();
                NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forIncomingCall(
                    callerPerson, declinePendingIntent, answerPendingIntent
                );
                Notification updated = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                    .setContentTitle(displayName)
                    .setContentText(isVideo ? "Incoming video call" : "Incoming voice call")
                    .setSmallIcon(ctx.getApplicationInfo().icon)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setFullScreenIntent(fullScreenPendingIntent, true)
                    .setContentIntent(fullScreenPendingIntent)
                    .setStyle(callStyle)
                    .setAutoCancel(true)
                    .setOngoing(true)
                    .build();
                nm.notify(callId.hashCode(), updated);
            } catch (Exception e) {
                Log.w("SahaplayIncomingCall", "fetchAndRefreshNotificationAvatar failed", e);
            }
        }).start();
    }

    // A plain colored-circle-with-initials avatar, drawn straight to a
    // Bitmap — RemoteViews has no equivalent of the Activity's own
    // RoundedBitmapDrawableFactory (that produces a Drawable for a real
    // View tree, not something a remote notification process can render);
    // a notification needs an actual Bitmap. Same palette/initials logic as
    // the in-Activity avatar (colorForUsername/initialsFor below) so the
    // notification and the full ring screen read as the same person's
    // avatar rather than two different placeholder styles. Deliberately
    // just the initials placeholder, not the user's real uploaded photo —
    // fetching and decoding that would mean a network round-trip before
    // this otherwise-instant notification could even show, and the
    // real photo is already one tap away (opening the notification body
    // shows the full ring screen, which does fetch+show it).
    static Bitmap buildInitialsAvatarBitmap(String username, int sizePx) {
        Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.parseColor(colorForUsername(username)));
        canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, bgPaint);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(sizePx * 0.4f);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setFakeBoldText(true);
        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float y = sizePx / 2f - (fm.ascent + fm.descent) / 2f;
        canvas.drawText(initialsFor(username), sizePx / 2f, y, textPaint);
        return bitmap;
    }

    // Routed through CallActionReceiver (a background BroadcastReceiver, not
    // a direct getActivity() PendingIntent) so the /extend-ring ping fires
    // BEFORE the app launch even starts — see ACTION_ANSWER_PING there and
    // the matching comment on backend/server.js's /extend-ring route. The
    // receiver itself then launches THIS Activity in its auto-answer mode
    // (EXTRA_AUTO_ANSWER) rather than firing the sahaplay://call-answer deep
    // link directly — that used to leave a blank gap between "notification
    // tapped" and "MainActivity's cold-started WebView finally paints
    // something," with nothing native shown in between. Carrying
    // caller/type/callee/display-name/avatar here (not just callId) is what
    // lets the receiver reconstruct this Activity's full extras without a
    // network round-trip of its own.
    private static PendingIntent buildAnswerPendingIntent(Context ctx, String callId, String callerUsername, String callType,
            String calleeUsername, String callerDisplayName, String callerAvatarPath, int piFlags) {
        Intent intent = new Intent(ctx, CallActionReceiver.class);
        intent.setAction(CallActionReceiver.ACTION_ANSWER_PING);
        intent.putExtra(CallActionReceiver.EXTRA_CALL_ID, callId);
        intent.putExtra(EXTRA_CALLER, callerUsername);
        intent.putExtra(EXTRA_CALL_TYPE, callType);
        intent.putExtra(EXTRA_CALLEE, calleeUsername);
        intent.putExtra(EXTRA_CALLER_DISPLAY_NAME, callerDisplayName);
        intent.putExtra(EXTRA_CALLER_AVATAR_PATH, callerAvatarPath);
        return PendingIntent.getBroadcast(ctx, callId.hashCode() ^ 2, intent, piFlags);
    }

    // Tracks whichever instance of this Activity is currently on screen, if
    // any — lets cancelForCallId() below reach into a live ring screen and
    // close it, not just clear the notification tray entry. Plain static
    // fields (not weak refs) are fine here: cleared unconditionally in
    // onDestroy(), and there's only ever at most one of these on screen at a
    // time (a second incoming call while one is already showing reuses this
    // same Activity via FLAG_ACTIVITY_SINGLE_TOP rather than stacking).
    private static IncomingCallActivity currentInstance;
    private static String currentInstanceCallId;

    // Called from SahaplayFirebaseMessagingService when a "call-cancel" data
    // push arrives (see sendCallCancelPush in backend/server.js) — the call
    // this callId refers to has been resolved some other way (declined,
    // timed out, cancelled, ended, or answered elsewhere) since the last
    // push was sent. Dismisses the tray notification unconditionally (covers
    // the case where this Activity was never opened at all), stops
    // SahaplayCallService (its own persistent ongoing-call notification uses
    // a fixed ID, not callId.hashCode(), so it needs its own explicit
    // cancel — harmless if it wasn't running for this call, or at all;
    // there's only ever one active call per device), and additionally
    // closes the full ring screen if it happens to be open showing this exact
    // call — tapping Answer/Decline on a call the server no longer knows
    // about would otherwise silently do nothing. Also releases a live
    // Telecom Connection if one exists (Phase 3) — otherwise the system
    // call UI/audio-focus reservation could outlive the notification it's
    // attached to.
    public static void cancelForCallId(Context ctx, String callId) {
        if (callId == null) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(callId.hashCode());
        Intent stopIntent = new Intent(ctx, SahaplayCallService.class);
        stopIntent.setAction(SahaplayCallService.ACTION_STOP);
        try { ctx.startService(stopIntent); } catch (Exception ignored) {}
        SahaplayConnection conn = SahaplayConnection.getCurrent(callId);
        if (conn != null) conn.disconnectFromEngine();
        if (currentInstance != null && callId.equals(currentInstanceCallId)) {
            currentInstance.finishAsMissed();
        }
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        callId = getIntent().getStringExtra(EXTRA_CALL_ID);
        callerUsername = getIntent().getStringExtra(EXTRA_CALLER);
        calleeUsername = getIntent().getStringExtra(EXTRA_CALLEE);
        String callType = getIntent().getStringExtra(EXTRA_CALL_TYPE);
        String pushedDisplayName = getIntent().getStringExtra(EXTRA_CALLER_DISPLAY_NAME);
        String pushedAvatarPath = getIntent().getStringExtra(EXTRA_CALLER_AVATAR_PATH);
        boolean isVideo = "video".equals(callType);

        if (callId == null || callerUsername == null) {
            finish();
            return;
        }

        currentInstance = this;
        currentInstanceCallId = callId;

        dismissNotification();

        showOverLockScreen();
        buildUi(callerUsername, isVideo);
        // Seed the name/avatar immediately from what the FCM push already
        // carried (see showIncomingCall's own comment on
        // EXTRA_CALLER_DISPLAY_NAME/EXTRA_CALLER_AVATAR_PATH) — no need to
        // wait on fetchCallerDetails()'s own network round trip for these.
        // fetchCallerDetails() still runs regardless, as a fallback/refresh.
        if (pushedDisplayName != null && !pushedDisplayName.isEmpty() && nameLabel != null) {
            nameLabel.setText(pushedDisplayName);
        }
        if (pushedAvatarPath != null && !pushedAvatarPath.isEmpty()) {
            // fetchAndSetAvatarBitmap does blocking network I/O — must run off
            // this (main) thread, unlike fetchCallerDetails() below which
            // already starts its own Thread before calling it.
            String avatarUrl = pushedAvatarPath.startsWith("http") ? pushedAvatarPath : (API_BASE + pushedAvatarPath);
            new Thread(() -> fetchAndSetAvatarBitmap(avatarUrl)).start();
        }
        fetchCallerDetails();

        // Launched from the notification/lock-screen Answer action itself
        // (see CallActionReceiver's ACTION_ANSWER_PING) rather than opened to
        // let the user choose — the user already answered, so skip straight
        // to the same "Connecting…" state the in-screen Answer button
        // produces, with no ring/timeout in between (there's nothing left to
        // ring for or time out — this call is already being answered).
        if (getIntent().getBooleanExtra(EXTRA_AUTO_ANSWER, false)) {
            onAnswerTapped();
            return;
        }

        startRinging();
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
    private TextView subLabel;
    private LinearLayout buttonRow;
    // True from the moment Answer is tapped until this screen is actually
    // torn down — see onAnswerTapped/onStop below.
    private boolean answerInProgress = false;

    // Reads the theme SahaplayMediaPlugin.setThemePreference last mirrored
    // from the web app (see App.jsx's applyTheme()) — a plain native
    // SharedPreferences read, not a plugin call, since this Activity can be
    // showing before the WebView/JS layer has ever started this launch.
    // Defaults to dark (this app's default theme) if nothing's been mirrored
    // yet, e.g. right after a fresh install before the app was ever opened.
    private boolean isLightTheme() {
        SharedPreferences prefs = getSharedPreferences(SahaplayMediaPlugin.THEME_PREFS_NAME, Context.MODE_PRIVATE);
        return "light".equals(prefs.getString(SahaplayMediaPlugin.THEME_PREFS_KEY, "dark"));
    }

    private void buildUi(String caller, boolean isVideo) {
        boolean isLight = isLightTheme();
        String bgColor = isLight ? "#F7FAFC" : "#0B0F1A";
        String nameColor = isLight ? "#111111" : "#FFFFFF";
        String subColor = isLight ? "#6B7280" : "#9CA3AF";
        String labelColor = isLight ? "#4B5563" : "#B3B3B3";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor(bgColor));
        root.setPadding(dp(24), dp(72), dp(24), dp(48));

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
        nameLabel.setTextColor(Color.parseColor(nameColor));
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        nameLabel.setTypeface(nameLabel.getTypeface(), Typeface.BOLD);
        nameLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        nameParams.topMargin = dp(20);
        root.addView(nameLabel, nameParams);

        subLabel = new TextView(this);
        subLabel.setText(isVideo ? "Incoming video call" : "Incoming voice call");
        subLabel.setTextColor(Color.parseColor(subColor));
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

        // Circular icon buttons with a separate label underneath each,
        // matching GlobalCallOverlay.jsx's own web ring screen exactly
        // (same layout, same red/green, same icon-above-label shape) so the
        // native and web incoming-call screens read as the same design
        // instead of two different UIs.
        buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER);
        root.addView(buttonRow, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        View declineCol = ringButtonColumn(R.drawable.ic_call_decline, "Decline", "#EF4444", labelColor, v -> { decline(); finish(); });
        View answerCol = ringButtonColumn(R.drawable.ic_call_answer, "Answer", "#22C55E", labelColor, v -> onAnswerTapped());

        LinearLayout.LayoutParams colParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        colParams.setMargins(dp(28), 0, dp(28), 0);
        buttonRow.addView(declineCol, colParams);
        buttonRow.addView(answerCol, colParams);

        setContentView(root);
    }

    // One circular icon button (62dp, matching gco-ring-btn in
    // GlobalCallOverlay.jsx) with its label centered underneath. A real
    // vector icon (ImageView), not a raw Unicode glyph — a plain TextView
    // showing "✕"/"☎" renders as a colorful emoji-style character on some
    // device fonts instead of a plain symbol.
    private View ringButtonColumn(int iconRes, String label, String bgColorHex, String labelColorHex, View.OnClickListener onClick) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        int size = dp(62);
        ImageView circle = new ImageView(this);
        circle.setImageResource(iconRes);
        circle.setScaleType(ImageView.ScaleType.CENTER);
        int iconPad = dp(18);
        circle.setPadding(iconPad, iconPad, iconPad, iconPad);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor(bgColorHex));
        circle.setBackground(bg);
        circle.setOnClickListener(onClick);
        col.addView(circle, new LinearLayout.LayoutParams(size, size));

        TextView labelView = new TextView(this);
        labelView.setText(label);
        labelView.setTextColor(Color.parseColor(labelColorHex));
        labelView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        labelView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = dp(8);
        col.addView(labelView, labelParams);

        return col;
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
                // A plain HttpURLConnection sends a Dalvik/JVM User-Agent and no
                // Accept header by default — indistinguishable from a bot to
                // some reverse-proxy/WAF setups that only allow browser-looking
                // traffic through, unlike every OTHER caller of this same
                // endpoint (JS's fetchUserBrief, the browser/WebView), which
                // always look like a real browser request. Matching that here
                // is cheap insurance against exactly this class of silent,
                // uncatchable failure — caught below only as a generic
                // IOException with nothing to distinguish it from a real
                // network error.
                conn.setRequestProperty("User-Agent", "SahaPlay-Android");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                int code = conn.getResponseCode();
                if (code != 200) {
                    Log.w("SahaplayIncomingCall", "fetchCallerDetails: GET " + url + " -> " + code);
                    return;
                }
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
                } else {
                    Log.w("SahaplayIncomingCall", "fetchCallerDetails: no avatarPath in response for " + callerUsername);
                }
            } catch (Exception e) {
                // No native JSON parser available without adding a dependency —
                // extractJsonStringField below is a minimal, deliberately narrow
                // scanner for these two known fields, not a general parser.
                Log.w("SahaplayIncomingCall", "fetchCallerDetails failed", e);
            }
        }).start();
    }

    // Runs on the same background thread fetchCallerDetails() already
    // started, keeping this second network hop off the main thread too.
    private void fetchAndSetAvatarBitmap(String avatarUrl) {
        try {
            URL url = new URL(avatarUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("User-Agent", "SahaPlay-Android");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            int code = conn.getResponseCode();
            if (code != 200) {
                Log.w("SahaplayIncomingCall", "fetchAndSetAvatarBitmap: GET " + url + " -> " + code);
                return;
            }
            Bitmap bitmap;
            try (InputStream is = conn.getInputStream()) {
                bitmap = BitmapFactory.decodeStream(is);
            }
            if (bitmap == null) {
                Log.w("SahaplayIncomingCall", "fetchAndSetAvatarBitmap: decodeStream returned null for " + avatarUrl);
                return;
            }
            Bitmap finalBitmap = bitmap;
            handler.post(() -> {
                if (avatarImage == null) return;
                RoundedBitmapDrawable rounded = RoundedBitmapDrawableFactory.create(getResources(), finalBitmap);
                rounded.setCircular(true);
                avatarImage.setImageDrawable(rounded);
                avatarImage.setVisibility(View.VISIBLE);
            });
        } catch (Exception e) {
            Log.w("SahaplayIncomingCall", "fetchAndSetAvatarBitmap failed for " + avatarUrl, e);
        }
    }

    // Deliberately minimal — avoids pulling in a JSON library dependency for
    // reading a couple of known fields. Not a general-purpose JSON parser.
    private static String extractJsonStringField(String json, String field) {
        String marker = "\"" + field + "\"";
        int idx = json.indexOf(marker);
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx + marker.length());
        if (colon < 0) return null;
        // Skip whitespace between the colon and the value. A user with no
        // avatar has a real "avatarPath":null in the response — without this
        // check, the old code went straight to indexOf('"', ...) and matched
        // the OPENING QUOTE OF A COMPLETELY UNRELATED LATER FIELD (e.g.
        // "bio":"...") instead, silently returning that field's text as if
        // it were the avatar path/display name. That bogus value then failed
        // to load as an image/name (caught and swallowed), which looked
        // identical to "no avatar" — same visible symptom, wrong reason, and
        // a latent risk of leaking an unrelated field's value.
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

    private void startRinging() {
        if (!startCustomRingtoneIfConfigured()) {
            startDefaultRingtone();
        }
        startVibrating();
    }

    // Prefers the user's own uploaded ringtone (AppSettings.jsx's Sound
    // section) over the phone's system default — mirrored into plain
    // SharedPreferences by SahaplayMediaPlugin.setRingtonePreference, same
    // pattern as the theme preference above, so this native screen can read
    // it without the WebView/JS layer having ever run. Streamed directly
    // from its HTTPS URL (Supabase storage) — MediaPlayer supports a remote
    // data source natively, no local download/caching needed. Returns false
    // when there's no custom ringtone configured, or the very first
    // setDataSource() call fails synchronously (a malformed URL); a failure
    // that only surfaces once the async prepare actually runs (dead link,
    // network error, unsupported format) is instead caught by
    // setOnErrorListener below, since by then this method has already
    // returned true.
    private boolean startCustomRingtoneIfConfigured() {
        String url;
        try {
            url = getSharedPreferences(SahaplayMediaPlugin.THEME_PREFS_NAME, Context.MODE_PRIVATE)
                .getString(SahaplayMediaPlugin.RINGTONE_PREFS_KEY, "");
        } catch (Exception e) {
            return false;
        }
        if (url == null || url.isEmpty()) return false;

        try {
            MediaPlayer mp = new MediaPlayer();
            ringtonePlayer = mp;
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            mp.setDataSource(url);
            mp.setLooping(true);
            // `ringtonePlayer != player` below guards against this callback
            // firing after stopRinging()/onDestroy() already moved on (e.g.
            // the user tapped Decline while the custom clip was still
            // buffering) — touching an already-released MediaPlayer throws.
            mp.setOnErrorListener((player, what, extra) -> {
                if (ringtonePlayer != player) return true;
                try { player.release(); } catch (Exception ignored) {}
                ringtonePlayer = null;
                startDefaultRingtone();
                return true;
            });
            mp.setOnPreparedListener(player -> {
                if (ringtonePlayer == player) {
                    try { player.start(); } catch (Exception ignored) {}
                }
            });
            // Network data source — prepare() would block the main thread
            // and throw; prepareAsync() + the listeners above handle it.
            mp.prepareAsync();
            return true;
        } catch (Exception e) {
            if (ringtonePlayer != null) {
                try { ringtonePlayer.release(); } catch (Exception ignored) {}
                ringtonePlayer = null;
            }
            return false;
        }
    }

    private void startDefaultRingtone() {
        try {
            Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri != null) {
                MediaPlayer mp = new MediaPlayer();
                ringtonePlayer = mp;
                mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                mp.setDataSource(this, ringtoneUri);
                mp.setLooping(true);
                mp.prepare();
                mp.start();
            }
        } catch (Exception ignored) {}
    }

    private void startVibrating() {
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

    // Answer's click handler used to call finish() synchronously in the same
    // click as answer() — destroying this screen the instant Answer was
    // tapped, before the separate WebView-based MainActivity had even started
    // loading. A cold launch fetches the whole site over the network (no
    // local bundling — Capacitor's own remote-URL config), which is
    // genuinely slow; finishing this screen immediately left a blank gap —
    // this screen gone, MainActivity's window not yet painted anything —
    // where it looked like tapping Answer had done nothing. Now this screen
    // stays up, morphed into its own native "Connecting…" state (see
    // showConnectingState below), until Android actually brings MainActivity
    // to the foreground — which happens naturally via onStop() further down,
    // so there's no frame where neither screen is showing anything.
    private void onAnswerTapped() {
        answerInProgress = true;
        stopRinging();
        answer();
        showConnectingState();
    }

    private void showConnectingState() {
        if (subLabel != null) subLabel.setText("Connecting…");
        if (buttonRow != null) buttonRow.setVisibility(View.GONE);
    }

    // Phase 3: this Activity is now only ever launched via a live
    // SahaplayConnection's onShowIncomingCallUi() (see
    // SahaplayConnectionService), so answering routes straight through it —
    // CallEngineService.acceptIncomingCall() does the real work (WebRTC
    // answer, entirely native, no WebView involved at all), and setActive()
    // tells Telecom the call is live (audio focus, Bluetooth routing).
    // Falls back to the old WebView deep-link hand-off only in the
    // unlikely case no live Connection is found (e.g. this Activity was
    // somehow reached a different way) — degraded, but still answerable.
    private void answer() {
        // This Activity being on screen at all (via the full-screen intent)
        // doesn't mean the separate JS/WebView layer has finished cold-
        // starting yet — extend the server's ring window before handing off,
        // same reasoning as CallActionReceiver's ACTION_ANSWER_PING for the
        // notification's own Answer action (see backend/server.js's
        // /extend-ring route). Harmless if the app was already warm and this
        // was never needed.
        postExtendRing(callId);
        SahaplayConnection conn = SahaplayConnection.getCurrent(callId);
        if (conn != null) {
            conn.answerFromUi();
            return;
        }
        Uri uri = Uri.parse("sahaplay://call-answer?callId=" + Uri.encode(callId));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage(getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
    }

    // Same Phase 3 routing as answer() above — prefers the live
    // SahaplayConnection (which also tells Telecom to release the call),
    // falling back to the direct REST decline (calleeUsername is THIS
    // device's own username — see the EXTRA_CALLEE comment above for why
    // this must not be callerUsername) if no Connection is found.
    private void decline() {
        stopRinging();
        SahaplayConnection conn = SahaplayConnection.getCurrent(callId);
        if (conn != null) {
            conn.declineFromUi();
            return;
        }
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

    private static void postExtendRing(String callId) {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/calls/" + Uri.encode(callId) + "/extend-ring");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write("{}".getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Only auto-finish the "Connecting…" state onAnswerTapped() left up —
        // MainActivity (or the launcher, if the user backed out some other
        // way) has taken the foreground either way, so this screen has
        // finished its job. Guarded to the post-Answer state specifically:
        // this Activity going to the background while still just ringing
        // (e.g. the user briefly switches apps) must NOT finish it — the
        // 45s ring timeout / notification tray entry still need it alive.
        if (answerInProgress && !isFinishing()) finish();
    }

    @Override
    protected void onDestroy() {
        stopRinging();
        handler.removeCallbacksAndMessages(null);
        if (currentInstance == this) {
            currentInstance = null;
            currentInstanceCallId = null;
        }
        super.onDestroy();
    }
}
