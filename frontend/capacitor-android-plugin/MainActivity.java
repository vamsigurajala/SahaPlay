package com.sahaplay.app;

import android.os.Bundle;

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
    }
}
