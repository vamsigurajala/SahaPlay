package com.sahaplay.app;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.util.Log;

// Registers SahaPlay as a self-managed Telecom PhoneAccount — the API
// WhatsApp/Signal/Telegram use for real background/lock-screen answering,
// system audio-focus arbitration, and Bluetooth/Auto reachability, without
// inserting into the system dialer (that's the unmanaged/default-dialer
// mode, which needs carrier entitlement — the wrong fit for a chat app).
//
// Idempotent and cheap — safe to call on every app start (see
// MainActivity.onCreate) and every incoming call push (see
// SahaplayFirebaseMessagingService), which is the intentionally simple
// mitigation for "some OEM skins silently drop registered PhoneAccounts on
// reboot or after a force-stop" (flagged as a known risk in the plan doc) —
// a dedicated BOOT_COMPLETED receiver would close the remaining gap (app
// never manually reopened after reboot) but isn't in scope for Phase 3.
public class PhoneAccountRegistrar {
    private static final String TAG = "SahaplayTelecom";
    public static final String ACCOUNT_ID = "sahaplay_self_managed";

    public static PhoneAccountHandle getHandle(Context context) {
        return new PhoneAccountHandle(new ComponentName(context, SahaplayConnectionService.class), ACCOUNT_ID);
    }

    public static void register(Context context) {
        // Self-managed ConnectionService requires API 26+ — matches the
        // MANAGE_OWN_CALLS permission's own minSdk, so pre-26 devices just
        // never get this call path (they keep the old direct-notification
        // fallback in SahaplayFirebaseMessagingService).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            TelecomManager telecomManager = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            if (telecomManager == null) return;
            PhoneAccountHandle handle = getHandle(context);
            PhoneAccount account = PhoneAccount.builder(handle, "SahaPlay")
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .setAddress(Uri.parse("sahaplay://calls"))
                .setShortDescription("SahaPlay calling")
                .build();
            telecomManager.registerPhoneAccount(account);
        } catch (Exception e) {
            Log.e(TAG, "PhoneAccount registration failed", e);
        }
    }
}
