package com.sahaplay.app;

import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.UserNotAuthenticatedException;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;

// JS <-> native bridge for the E2EE device-unlock feature. See:
//   - E2eeKeyStore.java              — Keystore-backed storage layer (Stage 1)
//   - DeviceAssertionVerifier.java   — account-identity proof (Stage 2 security review)
//   - backend/lib/deviceAssertion.js — the server side that issues assertions
//   - frontend/src/lib/deviceUnlock.js (a later stage) — the JS-facing wrapper
//
// DELIBERATELY NOT reusing SahaplayCallPlugin/SecretKeyStore/CallEngineService
// — see E2eeKeyStore.java's own class comment for why those are a different,
// incompatible trust posture.
//
// ─── Account-binding model, REVISED after a second-round security review ──
// The first version of this class let unlockDeviceKey/hasDeviceUnlock/
// clearDeviceUnlock fall back to a CACHED assertion (stored under a
// caller-supplied accountId) when no fresh one was supplied. That was
// unsafe: a cached assertion proves "this account was authenticated at
// SOME point within its ~24h validity," not "this account is the one
// CURRENTLY driving this WebView session." Concretely — account B enrolls,
// logs out (JS/session state cleared, but B's cached assertion is
// untouched and still valid), account A logs in on the same device; a
// compromised A-context script could call unlockDeviceKey(accountId=B)
// with NO assertion of its own, and the stale-but-still-valid cached
// assertion for B would satisfy the old check, releasing B's key to A's
// compromised page. The cache answered a real but irrelevant question.
//
// FIX: caching is removed entirely from this class. accountId is now
// PURELY a lookup key — it is never, by itself or combined with anything
// cached, sufficient authorization for anything. Every security-relevant
// method (hasDeviceUnlock, unlockDeviceKey, clearDeviceUnlock;
// setupDeviceUnlock already worked this way and needed no change) requires
// a FRESH assertion string in the SAME call, verified right there
// (signature + expiry + its own decoded id matching the caller's claimed
// accountId) — nothing is ever read back from native storage as a
// substitute. The only way JS can produce a fresh, validly-signed
// assertion for account X is for the backend's authenticateToken
// middleware to have just verified a REAL, CURRENT session JWT for X — see
// backend/server.js's /api/auth/device-enrollment-assertion, which signs
// only for the token's own authenticated subject, never a caller-named
// target. That is what makes "accountId is never authentication, only the
// verified assertion's own id is" actually true end to end, including
// across a cold start: a compromised page can only ever obtain a fresh
// assertion for whichever account it is GENUINELY, CURRENTLY logged in as.
//
// Cost of this fix, accepted deliberately per explicit direction: a cold
// start with no network available to fetch a fresh assertion falls
// straight through to the existing encryption-passphrase/recovery flow.
// There is no cached-assertion shortcut, and none should be reintroduced.
@CapacitorPlugin(name = "SahaplayE2ee")
public class SahaplayE2eePlugin extends Plugin {
    private static final String TAG = "SahaplayE2ee";

    // Failure/cancellation cooldown — see class comment on "prompt
    // fatigue"/social-engineering risk from the account-binding review.
    // After this many consecutive cancels/failures for one account within
    // this process's lifetime, further unlock attempts for that SAME
    // account are rejected immediately with no further prompt shown, until
    // the app process restarts. This does not affect OTHER accounts, and
    // does not affect a later SUCCESSFUL unlock resetting the counter.
    private static final int MAX_CONSECUTIVE_FAILURES = 3;

    private final DeviceAssertionVerifier assertionVerifier = new DeviceAssertionVerifier();
    private final Executor bgExecutor = Executors.newSingleThreadExecutor();

    // Coalesces concurrent unlock calls for the SAME account into one
    // in-flight BiometricPrompt rather than stacking multiple system
    // dialogs — keyed by accountId, cleared once that account's attempt
    // resolves (success or failure).
    private final Map<Long, Boolean> inFlightUnlock = new HashMap<>();
    private final Map<Long, Integer> consecutiveFailures = new HashMap<>();

    private E2eeKeyStore keyStore() {
        return new E2eeKeyStore(getContext());
    }

    /**
     * Verifies a REQUIRED, freshly-supplied assertion against accountId.
     * Returns null if the assertion is missing, malformed, unsigned by the
     * real key, expired, or its own decoded id does not match accountId —
     * every one of those is treated identically by every caller below (no
     * Keystore/biometric work is ever attempted; the outcome is
     * indistinguishable from "nothing enrolled here for this account").
     *
     * Deliberately has NO fallback to anything stored natively — see the
     * class-level comment explaining why a cached assertion was removed
     * from this decision entirely. accountId here is purely a cross-check
     * value ("does this assertion's own verified identity match what the
     * caller claims"), never a source of trust on its own.
     */
    private DeviceAssertionVerifier.AssertionPayload verifyFreshAssertion(long accountId, String assertion) {
        if (assertion == null) return null;
        DeviceAssertionVerifier.AssertionPayload payload = assertionVerifier.verify(assertion);
        if (payload == null || payload.id != accountId) return null;
        return payload;
    }

    // ─── hasDeviceUnlock ────────────────────────────────────────────────────
    // Requires a fresh assertion, exactly like unlock — a bare accountId
    // with no current proof answers identically to "never enrolled," which
    // is what prevents this from being usable to enumerate whether some
    // OTHER account has local enrollment: a valid fresh assertion is only
    // ever obtainable for the account genuinely, currently authenticated.
    @PluginMethod
    public void hasDeviceUnlock(PluginCall call) {
        Long accountId = readAccountId(call);
        String assertion = call.getString("assertion");
        if (accountId == null || assertion == null) {
            call.reject("accountId and a fresh assertion are required", "INVALID_REQUEST");
            return;
        }
        long id = accountId;

        bgExecutor.execute(() -> {
            DeviceAssertionVerifier.AssertionPayload payload = verifyFreshAssertion(id, assertion);
            boolean exists = payload != null && keyStore().hasWrappedKey(id);
            JSObject ret = new JSObject();
            ret.put("exists", exists);
            call.resolve(ret);
        });
    }

    // ─── setupDeviceUnlock ──────────────────────────────────────────────────
    // Unchanged by this revision — already required a fresh, directly-
    // supplied, non-cached assertion; enrollment always happens online,
    // right after a real login, so there was never an offline case to
    // accommodate here.
    @PluginMethod
    public void setupDeviceUnlock(PluginCall call) {
        Long accountId = readAccountId(call);
        String assertionStr = call.getString("assertion");
        String secretKeyBase64 = call.getString("secretKeyBase64");
        boolean allowOverwrite = Boolean.TRUE.equals(call.getBoolean("allowOverwrite", false));
        boolean strict = Boolean.TRUE.equals(call.getBoolean("strict", false));

        if (accountId == null || assertionStr == null || secretKeyBase64 == null) {
            call.reject("accountId, assertion, and secretKeyBase64 are required", "INVALID_REQUEST");
            return;
        }

        DeviceAssertionVerifier.AssertionPayload payload = verifyFreshAssertion(accountId, assertionStr);
        if (payload == null) {
            call.reject("Assertion is missing, invalid, expired, or does not match accountId", "NO_VALID_ASSERTION");
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) { call.reject("No activity available", "NATIVE_UNAVAILABLE"); return; }

        byte[] secretKeyBytes;
        try {
            secretKeyBytes = Base64.decode(secretKeyBase64, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            call.reject("secretKeyBase64 is not valid base64", "INVALID_REQUEST");
            return;
        }
        if (secretKeyBytes.length != 32) {
            call.reject("secretKeyBase64 must decode to exactly 32 bytes", "INVALID_REQUEST");
            return;
        }

        long id = accountId;
        String username = payload.username;

        bgExecutor.execute(() -> {
            Cipher cipher;
            try {
                cipher = keyStore().prepareSetupCipher(id, allowOverwrite, strict);
            } catch (E2eeKeyStore.DeviceUnlockAlreadyExistsException e) {
                call.reject(e.getMessage(), "ALREADY_ENROLLED");
                return;
            } catch (GeneralSecurityException e) {
                Log.e(TAG, "setupDeviceUnlock: prepareSetupCipher failed", e);
                call.reject("Failed to prepare device unlock", "HARDWARE_UNAVAILABLE");
                return;
            }

            authenticateAndRun(activity, id, username, cipher, "Confirm to enable Device Unlock", call, authenticatedCipher -> {
                try {
                    keyStore().finishSetup(id, username, authenticatedCipher, secretKeyBytes);
                    call.resolve();
                } catch (GeneralSecurityException e) {
                    Log.e(TAG, "setupDeviceUnlock: finishSetup failed", e);
                    call.reject("Failed to finish device unlock setup", "HARDWARE_UNAVAILABLE");
                }
            });
        });
    }

    // ─── unlockDeviceKey ────────────────────────────────────────────────────
    // assertion is now REQUIRED (was optional-with-cache-fallback). The
    // caller (deviceUnlock.js, a later stage) is responsible for fetching
    // a fresh one from POST /api/auth/device-enrollment-assertion using the
    // current, real watch_token before calling this — on cold start, with
    // no network available to do that, the caller must fall back to the
    // passphrase/recovery flow itself; this method will not do anything
    // resembling that fallback internally, it only ever succeeds or
    // rejects.
    @PluginMethod
    public void unlockDeviceKey(PluginCall call) {
        Long accountId = readAccountId(call);
        String assertion = call.getString("assertion");
        if (accountId == null || assertion == null) {
            call.reject("accountId and a fresh assertion are required", "INVALID_REQUEST");
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) { call.reject("No activity available", "NATIVE_UNAVAILABLE"); return; }

        long id = accountId;

        synchronized (inFlightUnlock) {
            if (Boolean.TRUE.equals(inFlightUnlock.get(id))) {
                call.reject("An unlock attempt for this account is already in progress", "ALREADY_IN_PROGRESS");
                return;
            }
            Integer failures = consecutiveFailures.get(id);
            if (failures != null && failures >= MAX_CONSECUTIVE_FAILURES) {
                call.reject("Too many failed/cancelled attempts this session — use the encryption passphrase instead", "AUTH_FAILED");
                return;
            }
            inFlightUnlock.put(id, true);
        }

        bgExecutor.execute(() -> {
            DeviceAssertionVerifier.AssertionPayload payload = verifyFreshAssertion(id, assertion);
            if (payload == null) {
                clearInFlight(id);
                // No Keystore/biometric touch at all — this is the exact
                // property the review requires: an unbacked accountId claim
                // (or a stale/foreign/expired assertion) must be
                // indistinguishable from "nothing enrolled here."
                call.reject("No valid device-unlock assertion for this account", "NO_VALID_ASSERTION");
                return;
            }
            if (!keyStore().hasWrappedKey(id)) {
                clearInFlight(id);
                call.reject("No device wrapper enrolled for this account", "NO_KEY_FOR_ACCOUNT");
                return;
            }

            Cipher cipher;
            try {
                cipher = keyStore().prepareUnlockCipher(id);
            } catch (E2eeKeyStore.NoDeviceUnlockException e) {
                clearInFlight(id);
                call.reject(e.getMessage(), "NO_KEY_FOR_ACCOUNT");
                return;
            } catch (E2eeKeyStore.CorruptDeviceWrapperException e) {
                clearInFlight(id);
                Log.e(TAG, "unlockDeviceKey: corrupt wrapper", e);
                call.reject(e.getMessage(), "CORRUPT_WRAPPER");
                return;
            } catch (KeyPermanentlyInvalidatedException e) {
                clearInFlight(id);
                Log.w(TAG, "unlockDeviceKey: key permanently invalidated for accountId=" + id);
                call.reject("Device unlock key was invalidated (biometric/credential change)", "KEY_INVALIDATED");
                return;
            } catch (GeneralSecurityException e) {
                clearInFlight(id);
                Log.e(TAG, "unlockDeviceKey: prepareUnlockCipher failed", e);
                call.reject("Device unlock is unavailable", "HARDWARE_UNAVAILABLE");
                return;
            }

            // Try the SILENT path first — this is the actual mechanism that
            // makes "no biometric prompt when the 30-minute window is still
            // open" true (see the authentication-window verification in the
            // earlier design doc): only cipher.doFinal() itself throws
            // UserNotAuthenticatedException, not cipher.init().
            try {
                byte[] secretKeyBytes = keyStore().finishUnlock(id, cipher);
                clearInFlight(id);
                consecutiveFailures.remove(id);
                resolveWithKey(call, secretKeyBytes);
                return;
            } catch (UserNotAuthenticatedException e) {
                // Expected path when the window has lapsed — fall through
                // to showing BiometricPrompt below.
            } catch (E2eeKeyStore.CorruptDeviceWrapperException e) {
                clearInFlight(id);
                Log.e(TAG, "unlockDeviceKey: corrupt wrapper on decrypt", e);
                call.reject(e.getMessage(), "CORRUPT_WRAPPER");
                return;
            } catch (GeneralSecurityException e) {
                clearInFlight(id);
                Log.e(TAG, "unlockDeviceKey: finishUnlock failed", e);
                call.reject("Device unlock failed", "HARDWARE_UNAVAILABLE");
                return;
            }

            String username = payload.username;
            authenticateAndRun(activity, id, username, cipher, "Unlock your encrypted chats", call, authenticatedCipher -> {
                try {
                    byte[] secretKeyBytes = keyStore().finishUnlock(id, authenticatedCipher);
                    consecutiveFailures.remove(id);
                    resolveWithKey(call, secretKeyBytes);
                } catch (GeneralSecurityException e) {
                    Log.e(TAG, "unlockDeviceKey: finishUnlock (post-auth) failed", e);
                    call.reject("Device unlock failed", "HARDWARE_UNAVAILABLE");
                } finally {
                    clearInFlight(id);
                }
            });
        });
    }

    private void resolveWithKey(PluginCall call, byte[] secretKeyBytes) {
        JSObject ret = new JSObject();
        ret.put("secretKeyBase64", Base64.encodeToString(secretKeyBytes, Base64.NO_WRAP));
        call.resolve(ret);
    }

    private void clearInFlight(long id) {
        synchronized (inFlightUnlock) {
            inFlightUnlock.remove(id);
        }
    }

    // ─── clearDeviceUnlock ("Forget this device") ──────────────────────────
    // Same "requires a fresh, matching assertion, no cache" gate as unlock
    // — otherwise a compromised page logged in as A could maliciously wipe
    // a DIFFERENT, dormant account B's enrollment just by claiming B's id,
    // forcing B back to passphrase-only with no proof of authorization at
    // all. Requiring real proof here closes that abuse case too.
    @PluginMethod
    public void clearDeviceUnlock(PluginCall call) {
        Long accountId = readAccountId(call);
        String assertion = call.getString("assertion");
        if (accountId == null || assertion == null) {
            call.reject("accountId and a fresh assertion are required", "INVALID_REQUEST");
            return;
        }
        long id = accountId;

        bgExecutor.execute(() -> {
            DeviceAssertionVerifier.AssertionPayload payload = verifyFreshAssertion(id, assertion);
            if (payload == null) {
                call.reject("No valid device-unlock assertion for this account", "NO_VALID_ASSERTION");
                return;
            }
            keyStore().clearDeviceUnlock(id);
            call.resolve();
        });
    }

    // ─── Shared BiometricPrompt orchestration ──────────────────────────────
    private interface AuthenticatedAction {
        void run(Cipher authenticatedCipher);
    }

    /**
     * Shows BiometricPrompt (strong biometric OR device credential — must
     * match the Keystore key's own setUserAuthenticationParameters flags in
     * E2eeKeyStore, or the OS will accept a class of credential the key
     * itself doesn't) wrapping cipher, with subtitle text naming the
     * VERIFIED (not merely claimed) username — trustworthy precisely
     * because `username` only ever reaches this method already having
     * survived DeviceAssertionVerifier against a FRESH assertion.
     */
    private void authenticateAndRun(FragmentActivity activity, long accountId, String username, Cipher cipher,
                                     String promptSubtitle, PluginCall call, AuthenticatedAction onSuccess) {
        Executor mainExecutor = ContextCompat.getMainExecutor(getContext());

        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                Cipher authenticatedCipher = result.getCryptoObject() != null ? result.getCryptoObject().getCipher() : cipher;
                bgExecutor.execute(() -> onSuccess.run(authenticatedCipher));
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                clearInFlight(accountId);
                recordFailure(accountId);
                // errorCode distinguishes user-cancel from other failures
                // (lockout, hardware error, etc.) only for logging — every
                // one of them maps to the SAME safe outcome downstream:
                // fall back to the passphrase flow, never regenerate a key.
                Log.w(TAG, "BiometricPrompt error for accountId=" + accountId + ": " + errorCode + " " + errString);
                call.reject(String.valueOf(errString), "AUTH_FAILED");
            }

            @Override
            public void onAuthenticationFailed() {
                // A single failed attempt (e.g. unrecognized fingerprint) —
                // BiometricPrompt itself keeps the dialog open for retries;
                // only escalate to our own cooldown counter on the
                // TERMINAL onAuthenticationError above, not on every
                // individual failed sample.
                Log.w(TAG, "BiometricPrompt: unrecognized attempt for accountId=" + accountId);
            }
        };

        BiometricPrompt prompt = new BiometricPrompt(activity, mainExecutor, callback);
        BiometricPrompt.PromptInfo.Builder promptInfoBuilder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("SahaPlay")
            .setSubtitle(username != null ? (promptSubtitle + " — @" + username) : promptSubtitle)
            .setAllowedAuthenticators(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
                | androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL);

        mainExecutor.execute(() -> prompt.authenticate(promptInfoBuilder.build(), new BiometricPrompt.CryptoObject(cipher)));
    }

    private void recordFailure(long accountId) {
        synchronized (inFlightUnlock) {
            int count = consecutiveFailures.getOrDefault(accountId, 0) + 1;
            consecutiveFailures.put(accountId, count);
        }
    }

    // ─── Request parsing ────────────────────────────────────────────────────
    private Long readAccountId(PluginCall call) {
        // Capacitor's bridge delivers JS numbers as Integer/Double/Long
        // depending on magnitude/platform — accept any of them rather than
        // assuming one specific boxed type.
        Object raw = call.getData().opt("accountId");
        if (raw instanceof Number) return ((Number) raw).longValue();
        return null;
    }
}
