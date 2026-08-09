package com.sahaplay.app;

import android.os.Bundle;
import android.webkit.WebSettings;

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
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SahaplayMediaPlugin.class);
        super.onCreate(savedInstanceState);

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
    }
}
