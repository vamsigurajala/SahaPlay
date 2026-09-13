package com.sahaplay.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.test.core.app.ApplicationProvider;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;

import java.util.Arrays;

// Robolectric, not a plain JVM test, because E2eeKeyStore touches
// SharedPreferences (a real Android framework class Robolectric provides a
// working shadow for) — no Android device/emulator required to run this.
//
// IMPORTANT, explicitly not glossed over: Robolectric does NOT provide a
// working "AndroidKeyStore" JCA provider — there is no real TEE/StrongBox/
// software Keystore to shadow. This means everything in E2eeKeyStore that
// actually touches a Keystore key (prepareSetupCipher, finishSetup,
// prepareUnlockCipher, finishUnlock, and the generateKey/loadKeystoreKey
// internals they call) CANNOT be exercised by this test class, or by any
// JVM-only test, at all. That logic can only be verified against a real
// device or emulator with a real Keystore — this repo's own established
// verification path for native Android code (CI build -> bundletool ->
// sideload; see the calling-engine work's documented history) is the only
// way to do that, since no local Android device/emulator is available in
// this development environment either.
//
// What THIS test class covers instead, deliberately scoped to what's
// actually testable without a real Keystore:
//   - the IV/ciphertext packing envelope (pure byte manipulation, no
//     Android Keystore involved)
//   - per-account key namespacing in SharedPreferences (real shadow-backed
//     Preferences, no Keystore needed)
//   - clearDeviceUnlock's prefs-side behavior and idempotency
@RunWith(RobolectricTestRunner.class)
public class E2eeKeyStoreTest {

    private Context context;
    private E2eeKeyStore store;

    @Before
    public void setUp() {
        context = ApplicationProvider.getApplicationContext();
        store = new E2eeKeyStore(context);
    }

    // ─── IV/ciphertext packing (pure logic, no Keystore) ──────────────────

    @Test
    public void packAndUnpack_roundTripsExactBytes() {
        byte[] iv = new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}; // 12 bytes, typical GCM IV
        byte[] ciphertext = new byte[48]; // 32-byte key + 16-byte GCM tag
        for (int i = 0; i < ciphertext.length; i++) ciphertext[i] = (byte) (i * 3);

        String packed = E2eeKeyStore.packIvAndCiphertext(iv, ciphertext);
        byte[][] unpacked = E2eeKeyStore.unpackIvAndCiphertext(packed);

        assertArrayEquals("IV must round-trip exactly", iv, unpacked[0]);
        assertArrayEquals("Ciphertext must round-trip exactly", ciphertext, unpacked[1]);
    }

    @Test
    public void packAndUnpack_handlesUnusualIvLengths() {
        // GCM IVs are conventionally 12 bytes, but the envelope format
        // (1-byte length prefix) supports any length up to 255 — verify it
        // isn't hardcoded to exactly 12.
        byte[] iv = new byte[]{9, 9};
        byte[] ciphertext = new byte[]{1, 2, 3, 4};
        byte[][] unpacked = E2eeKeyStore.unpackIvAndCiphertext(E2eeKeyStore.packIvAndCiphertext(iv, ciphertext));
        assertArrayEquals(iv, unpacked[0]);
        assertArrayEquals(ciphertext, unpacked[1]);
    }

    @Test(expected = IllegalArgumentException.class)
    public void unpack_rejectsNullBlob() {
        E2eeKeyStore.unpackIvAndCiphertext(null);
    }

    @Test(expected = IllegalArgumentException.class)
    public void unpack_rejectsNonBase64Garbage() {
        E2eeKeyStore.unpackIvAndCiphertext("not valid base64 at all !!!");
    }

    @Test(expected = IllegalArgumentException.class)
    public void unpack_rejectsEmptyBlob() {
        E2eeKeyStore.unpackIvAndCiphertext(android.util.Base64.encodeToString(new byte[0], android.util.Base64.NO_WRAP));
    }

    @Test(expected = IllegalArgumentException.class)
    public void unpack_rejectsTruncatedIv() {
        // Declares a 12-byte IV but only provides 3 bytes total after the
        // length prefix — simulates a corrupted/truncated stored wrapper,
        // exactly the case CorruptDeviceWrapperException exists for
        // upstream in prepareUnlockCipher/finishUnlock.
        byte[] malformed = new byte[]{12, 1, 2, 3};
        E2eeKeyStore.unpackIvAndCiphertext(android.util.Base64.encodeToString(malformed, android.util.Base64.NO_WRAP));
    }

    // ─── Per-account namespacing (SharedPreferences, no Keystore needed) ───

    @Test
    public void hasWrappedKey_falseWhenNothingEnrolled() {
        assertFalse(store.hasWrappedKey(1L));
        assertFalse(store.hasWrappedKey(999999L));
    }

    @Test
    public void differentAccountIds_doNotCollideOrCrossUnlock() {
        // Writes directly to the same SharedPreferences file E2eeKeyStore
        // itself uses, bypassing the real (non-Robolectric-shadowable)
        // Keystore step — this isolates and proves the per-account key
        // NAMING/NAMESPACING logic specifically (the exact property the
        // multi-account requirement in the design doc depends on), without
        // needing a real wrapped key to do it.
        SharedPreferences prefs = context.getSharedPreferences("sahaplay_e2ee_store", Context.MODE_PRIVATE);
        prefs.edit()
            .putString("wrapped_key_100", "account-100-blob")
            .putString("username_hint_100", "alice")
            .putString("wrapped_key_200", "account-200-blob")
            .putString("username_hint_200", "bob")
            .apply();

        assertTrue("Account 100's own entry must be visible", store.hasWrappedKey(100L));
        assertTrue("Account 200's own entry must be visible", store.hasWrappedKey(200L));
        assertEquals("alice", store.getUsernameHint(100L));
        assertEquals("bob", store.getUsernameHint(200L));

        // The core multi-account safety property: deleting one account's
        // enrollment must never touch a different account's entry.
        store.clearDeviceUnlock(100L);
        assertFalse("Account 100 must be gone after clearDeviceUnlock(100)", store.hasWrappedKey(100L));
        assertTrue("Account 200 must be UNAFFECTED by clearing account 100", store.hasWrappedKey(200L));
        assertEquals("bob", store.getUsernameHint(200L));
    }

    @Test
    public void clearDeviceUnlock_isIdempotentWhenNothingWasEnrolled() {
        // "Forget this device" must never throw just because the account
        // was never enrolled in the first place (e.g. double-tap, or
        // called defensively on logout for an account that only ever used
        // the passphrase flow).
        store.clearDeviceUnlock(42L);
        assertFalse(store.hasWrappedKey(42L));

        // Calling it a second time must also be a safe no-op.
        store.clearDeviceUnlock(42L);
        assertFalse(store.hasWrappedKey(42L));
    }

    @Test
    public void getUsernameHint_nullWhenNeverSet() {
        assertNull(store.getUsernameHint(12345L));
    }

    @Test
    public void wasStrongBoxUsed_falseByDefault() {
        // Diagnostic-only flag — must default to false rather than throwing
        // or returning a stale value for an account that never enrolled.
        assertFalse(store.wasStrongBoxUsed(12345L));
    }
}
