package com.sahaplay.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

// Robolectric only because android.util.Base64 needs it (see
// DeviceAssertionVerifier's own class comment — the actual EC
// signature verification logic here is plain java.security, no Android
// framework dependency at all).
//
// This test class signs its OWN assertions with a throwaway EC keypair
// generated in @BeforeClass, then verifies them against a
// DeviceAssertionVerifier constructed with that SAME throwaway public key
// (via the package-private test constructor) — never against the real
// embedded production key, and no real production private key material is
// used or needed here at all.
//
// The exact wire format (base64url header/payload/signature, ES256,
// SHA256withECDSA/DER) mirrors backend/lib/deviceAssertion.js's own
// signAssertion() byte-for-byte — this test hand-builds that format
// directly (rather than importing anything from the backend, which is a
// separate Node project) to prove the ANDROID side's parsing/verification
// is compatible with what the backend actually produces, independent of
// either side's own internal helper functions.
@RunWith(RobolectricTestRunner.class)
public class DeviceAssertionVerifierTest {

    private static PrivateKey privateKey;
    private static PublicKey publicKey;

    @BeforeClass
    public static void generateKeyPair() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1")); // same curve as prime256v1/P-256
        KeyPair pair = gen.generateKeyPair();
        privateKey = pair.getPrivate();
        publicKey = pair.getPublic();
    }

    private static String base64Url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    /** Hand-builds an assertion string, signing with the given key — mirrors backend/lib/deviceAssertion.js exactly. */
    private static String buildAssertion(long id, String username, long expEpochSeconds, PrivateKey signingKey) throws Exception {
        String header = "{\"alg\":\"ES256\",\"typ\":\"SPDA\"}";
        String payload = String.format(
            "{\"id\":%d,\"username\":%s,\"exp\":%d}",
            id, username == null ? "null" : ("\"" + username + "\""), expEpochSeconds);
        String headerB64 = base64Url(header.getBytes("UTF-8"));
        String payloadB64 = base64Url(payload.getBytes("UTF-8"));
        String signingInput = headerB64 + "." + payloadB64;

        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(signingKey);
        signer.update(signingInput.getBytes("UTF-8"));
        byte[] signature = signer.sign(); // DER by default, matching deviceAssertion.js's dsaEncoding:'der'

        return signingInput + "." + base64Url(signature);
    }

    private static long nowPlusSeconds(long seconds) {
        return (System.currentTimeMillis() / 1000L) + seconds;
    }

    @Test
    public void validAssertion_verifiesAndReturnsCorrectPayload() throws Exception {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        String assertion = buildAssertion(42, "alice", nowPlusSeconds(3600), privateKey);

        DeviceAssertionVerifier.AssertionPayload payload = verifier.verify(assertion);

        assertNotNull("a validly-signed, unexpired assertion must verify", payload);
        assertEquals(42, payload.id);
        assertEquals("alice", payload.username);
    }

    @Test
    public void nullUsername_isPreservedAsNull() throws Exception {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        String assertion = buildAssertion(7, null, nowPlusSeconds(60), privateKey);
        DeviceAssertionVerifier.AssertionPayload payload = verifier.verify(assertion);
        assertNotNull(payload);
        assertNull(payload.username);
    }

    // ─── This is the exact property the Stage 2 security review exists to
    // guarantee on the NATIVE side specifically (the backend test file
    // proves the same property server-side) — a forged/tampered/foreign-
    // signed assertion must NEVER verify against the real embedded key. ───

    @Test
    public void assertionSignedByDifferentKeyPair_neverVerifies() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair attackerPair = gen.generateKeyPair();

        // Attacker signs a claim of id=42 with THEIR OWN key, not the real
        // server's private key.
        String forged = buildAssertion(42, "alice", nowPlusSeconds(3600), attackerPair.getPrivate());

        // Verifier only trusts the REAL public key.
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        assertNull("an assertion not signed by the real server key must never verify",
            verifier.verify(forged));
    }

    @Test
    public void tamperedPayload_invalidatesSignature() throws Exception {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        String assertion = buildAssertion(42, "alice", nowPlusSeconds(3600), privateKey);
        String[] parts = assertion.split("\\.");
        // Simulate an attacker trying to change the claimed id after signing.
        String tamperedPayloadB64 = base64Url("{\"id\":999,\"username\":\"alice\",\"exp\":9999999999}".getBytes("UTF-8"));
        String tampered = parts[0] + "." + tamperedPayloadB64 + "." + parts[2];
        assertNull(verifier.verify(tampered));
    }

    @Test
    public void expiredAssertion_doesNotVerify() throws Exception {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        String assertion = buildAssertion(42, "alice", nowPlusSeconds(-10), privateKey); // already expired
        assertNull(verifier.verify(assertion));
    }

    @Test
    public void malformedInput_neverThrowsAndReturnsNull() {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        assertNull(verifier.verify(null));
        assertNull(verifier.verify(""));
        assertNull(verifier.verify("not.enough"));
        assertNull(verifier.verify("a.b.c.d"));
        assertNull(verifier.verify("!!!.###.$$$"));
    }

    @Test
    public void wrongAlgorithmHeader_isRejected() throws Exception {
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier(publicKey);
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"SPDA\"}".getBytes("UTF-8"));
        String payload = base64Url("{\"id\":42,\"username\":\"alice\",\"exp\":9999999999}".getBytes("UTF-8"));
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(privateKey);
        signer.update((header + "." + payload).getBytes("UTF-8"));
        String assertion = header + "." + payload + "." + base64Url(signer.sign());
        assertNull("a non-ES256 header must be rejected even if otherwise validly signed", verifier.verify(assertion));
    }

    @Test
    public void productionEmbeddedPublicKey_loadsWithoutThrowing() {
        // Exercises the REAL no-arg constructor (loads the actual embedded
        // production public key PEM) — this only proves the constant is
        // well-formed and loadable, not that it matches any particular
        // private key (that's what the backend's own round-trip test
        // proves, using the real pair).
        DeviceAssertionVerifier verifier = new DeviceAssertionVerifier();
        // A garbage assertion must still just return null, not throw, even
        // through the real embedded key.
        assertNull(verifier.verify("garbage"));
    }
}
