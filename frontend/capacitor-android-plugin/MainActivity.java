package com.sahaplay.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

// Overwrites the file `npx cap add android` generates (a bare
// `BridgeActivity` subclass with no registration) rather than sed/regex
// patching it in CI — replacing the whole known-small file outright is more
// robust than text-surgery against a template whose exact byte content can
// shift between Capacitor versions. Registers the custom native plugin (see
// SahaplayMediaPlugin.java) before super.onCreate(), as Capacitor's plugin
// registration requires.
public class MainActivity extends BridgeActivity {
    // Hosts the real Android permission request for photos/videos (see
    // SahaplayMediaPlugin.ensurePhotoPermissions, which calls
    // getPhotoPermissionLauncher().launch(...) instead of Capacitor's own
    // requestPermissionForAlias/@PermissionCallback machinery). That
    // Capacitor-provided mechanism is the same one already confirmed (see
    // nativeMedia.js's ensureNativeMediaPermissions comment) to sometimes
    // silently resolve "not granted" WITHOUT ever showing Android's system
    // dialog on a fresh install — camera/mic worked around it by going
    // through getUserMedia() instead (a browser API with its own,
    // independently-reliable permission bridge), but there's no such
    // browser-API equivalent for storage/photos, so this calls
    // ActivityResultContracts.RequestPermission() directly instead, the
    // same AndroidX API Capacitor's own wrapper uses internally, but without
    // going through whatever step in that wrapper was dropping the request.
    // Registration MUST happen before this Activity reaches STARTED —
    // doing it here in onCreate (before super.onCreate() returns control
    // past it) satisfies that.
    private ActivityResultLauncher<String[]> photoPermissionLauncher;
    private ActivityResultLauncher<String[]> cameraPermissionLauncher;

    public ActivityResultLauncher<String[]> getPhotoPermissionLauncher() {
        return photoPermissionLauncher;
    }

    public ActivityResultLauncher<String[]> getCameraPermissionLauncher() {
        return cameraPermissionLauncher;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Debugging-only, no security/behavior impact: a signed release
        // build (assembleRelease, what CI ships) does NOT mirror WebView
        // console.log/warn/error output to logcat, and chrome://inspect
        // can't attach to its WebView either, by default — only a
        // debuggable (non-release) build normally gets this. Turning it on
        // unconditionally here is the standard, documented way to keep
        // that visibility in a release build too; it does not affect
        // Keystore/biometric/E2EE logic or expose any secret — it only
        // controls whether the OS *lets a debugger attach to this WebView
        // at all*, which still requires the developer to have adb/USB or
        // wireless-debugging access to the device itself.
        WebView.setWebContentsDebuggingEnabled(true);

        registerPlugin(SahaplayMediaPlugin.class);
        registerPlugin(SahaplayCallPlugin.class);
        registerPlugin(SahaplayE2eePlugin.class);
        photoPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> SahaplayMediaPlugin.onPhotoPermissionResult(result)
        );
        cameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> SahaplayMediaPlugin.onCameraPermissionResult(result)
        );
        super.onCreate(savedInstanceState);

        // The WebView's OWN native scrollbar overlay (a plain Android View
        // property, entirely separate from anything the page's CSS draws)
        // was showing as a persistent thin scrollbar on the far right edge
        // of every scrollable page — no amount of ::-webkit-scrollbar CSS
        // can touch this, since it isn't part of the page at all. The page
        // itself already hides its own CSS scrollbar in this same build
        // (see index.css's html.pwa-standalone rule); this removes the
        // WebView's separate native one so no scrollbar shows at all,
        // while normal scrolling (touch drag, fling) is untouched.
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);

        // Several OEM Android skins (Samsung/Xiaomi's own system-wide
        // "Dark mode for all apps" force-dark setting especially) apply
        // Android's algorithmic WebView darkening on top of ANY page,
        // including ones that are already permanently dark by design (the
        // call screens, in-call dock/menus) — repainting their own
        // already-white text into a dim, low-contrast grey. This is
        // OS/OEM-side pixel repainting, not something any amount of CSS
        // !important can override from inside the page, and only happens on
        // SOME devices depending on their dark-mode heuristic — matching
        // the reported "text is unreadable on some phones, fine on others."
        // Disabling force-dark for this WebView specifically (the app
        // already handles its own light/dark theming in CSS) removes that
        // whole class of bug at the source.
        WebSettings settings = getBridge().getWebView().getSettings();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF);
        }

        // Idempotent — see PhoneAccountRegistrar's own class comment for
        // why this runs on every app start rather than once at install
        // time (some OEM skins silently drop a registered self-managed
        // PhoneAccount on reboot or after a force-stop).
        PhoneAccountRegistrar.register(this);
    }

    // Lets SahaplayFirebaseMessagingService tell whether the app is actually
    // on screen right now, before deciding to launch IncomingCallActivity's
    // full-screen native ring UI for an incoming call push (see that
    // decision at the call site). Without this, that native screen used to
    // launch UNCONDITIONALLY for every single incoming call — including
    // while the app was already open and its own JS layer (CallContext.jsx,
    // via the live 'call:incoming' socket event that arrives in parallel
    // with this same push) was ALREADY showing its own ring screen. The
    // native Activity would land on top of it (FLAG_ACTIVITY_SINGLE_TOP
    // brings it to the very front of the task), so tapping what looked like
    // "the app's own Answer button" actually hit this native screen's
    // button first — which only calls setActive()/deep-links back into the
    // already-open app (see SahaplayConnection.answerFromUi() and
    // nativeCallBridge.js's own comment on why that deep link deliberately
    // does NOT auto-accept anymore) rather than actually answering anything.
    // The real accept only happened on the SECOND tap, once the redundant
    // native screen had dismissed and the underlying JS Answer button was
    // finally reachable — this is what made answering read as "tap twice,
    // sometimes three times, before it connects."
    //
    // onResume/onPause (not onStart/onStop) deliberately errs toward "assume
    // backgrounded" the instant this Activity loses full focus (e.g. a
    // system permission dialog briefly covering it) — the failure direction
    // that matters here is asymmetric: wrongly treating the app as
    // backgrounded just means one redundant ring screen still shows (the
    // existing, already-working behavior), while wrongly treating it as
    // foregrounded could mean a call never visibly rings at all. Defaulting
    // false (see the field below) means the same fail-safe applies before
    // this Activity has ever resumed even once (a cold app start).
    private static volatile boolean isForeground = false;

    public static boolean isForeground() {
        return isForeground;
    }

    @Override
    protected void onResume() {
        super.onResume();
        isForeground = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        isForeground = false;
    }
}
