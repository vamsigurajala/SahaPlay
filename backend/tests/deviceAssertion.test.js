const { test, describe } = require('node:test');
const assert = require('node:assert');
const { generateKeyPairSync } = require('node:crypto');

const { signDeviceAssertion, verifyDeviceAssertion } = require('../lib/deviceAssertion');

// A fresh, throwaway EC P-256 keypair generated once for this test file —
// never the real production key (that only ever lives in the
// DEVICE_ASSERTION_PRIVATE_KEY env var). Exercises exactly the same code
// path server.js's /api/auth/device-enrollment-assertion route uses.
function freshKeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('Device enrollment assertion — sign/verify round trip', () => {

  test('a freshly-signed assertion verifies successfully with the matching public key', () => {
    const { publicKey, privateKey } = freshKeyPair();
    const assertion = signDeviceAssertion({ id: 42, username: 'alice' }, privateKey);
    const payload = verifyDeviceAssertion(assertion, publicKey);
    assert.ok(payload, 'a validly-signed, unexpired assertion must verify');
    assert.strictEqual(payload.id, 42);
    assert.strictEqual(payload.username, 'alice');
    assert.ok(payload.exp > Math.floor(Date.now() / 1000), 'exp must be in the future');
  });

  test('assertion is three base64url segments (native parses this with plain string splitting)', () => {
    const { privateKey } = freshKeyPair();
    const assertion = signDeviceAssertion({ id: 1, username: 'x' }, privateKey);
    assert.strictEqual(assertion.split('.').length, 3);
    // base64url alphabet only — no '+', '/', or padding '=' — matches what
    // the Android side's own base64url decode expects with zero pre-processing.
    assert.ok(!/[+/=]/.test(assertion), 'must be pure base64url, no standard-base64 characters');
  });

  // ─── This is the exact property the Stage 2 security review exists to
  // guarantee: a forged/tampered assertion must NEVER verify. ───

  test('tampering with the payload segment invalidates the signature', () => {
    const { publicKey, privateKey } = freshKeyPair();
    const assertion = signDeviceAssertion({ id: 42, username: 'alice' }, privateKey);
    const [header, payload, sig] = assertion.split('.');
    // Flip one character in the payload — simulates an attacker trying to
    // change `id` from 42 to some other account's id after the fact.
    const flipped = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A');
    const tampered = `${header}.${flipped}.${sig}`;
    assert.strictEqual(verifyDeviceAssertion(tampered, publicKey), null);
  });

  test('a fabricated assertion (garbage signature, no real private key involved) never verifies', () => {
    const { publicKey } = freshKeyPair();
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'SPDA' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 999, username: 'victim', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const fakeSig = Buffer.from('not a real signature').toString('base64url');
    const forged = `${header}.${payload}.${fakeSig}`;
    assert.strictEqual(verifyDeviceAssertion(forged, publicKey), null,
      'this is the exact forgery the account-binding review traced: fabricating a claimed id with no real signing key must never produce a valid assertion');
  });

  test('an assertion signed by a DIFFERENT keypair never verifies against this server\'s public key', () => {
    const attackerKeys = freshKeyPair();
    const realKeys = freshKeyPair();
    // An attacker who controls their own EC keypair (but not the real
    // server's private key) cannot produce anything that verifies against
    // the real public key embedded in the client.
    const assertion = signDeviceAssertion({ id: 42, username: 'alice' }, attackerKeys.privateKey);
    assert.strictEqual(verifyDeviceAssertion(assertion, realKeys.publicKey), null);
  });

  test('an expired assertion does not verify', () => {
    const { publicKey, privateKey } = freshKeyPair();
    const expired = signDeviceAssertion({ id: 42, username: 'alice' }, privateKey, -10 /* already expired */);
    assert.strictEqual(verifyDeviceAssertion(expired, publicKey), null);
  });

  test('verifyDeviceAssertion never throws on garbage input', () => {
    const { publicKey } = freshKeyPair();
    for (const bad of [null, undefined, '', 'not.even.three.parts', 'a.b', '....', 123, {}]) {
      assert.doesNotThrow(() => verifyDeviceAssertion(bad, publicKey));
    }
  });

  test('signDeviceAssertion requires an account id', () => {
    const { privateKey } = freshKeyPair();
    assert.throws(() => signDeviceAssertion({ username: 'no-id' }, privateKey));
    assert.throws(() => signDeviceAssertion(null, privateKey));
  });

  test('username is carried through so the native biometric prompt can display a verified (not merely claimed) account name', () => {
    const { publicKey, privateKey } = freshKeyPair();
    const assertion = signDeviceAssertion({ id: 7, username: 'bob' }, privateKey);
    const payload = verifyDeviceAssertion(assertion, publicKey);
    assert.strictEqual(payload.username, 'bob');
  });
});
