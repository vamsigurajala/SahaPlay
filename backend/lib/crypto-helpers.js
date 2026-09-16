function validateE2EEMessage(data) {
  // Media-only messages (images, files, voice notes) do not carry text E2EE fields — they are allowed through
  const isMediaOnly = (
    !data.message &&
    !data.e2ee &&
    (data.mediaUrl || data.fileUrl || data.mediaType)
  );
  if (isMediaOnly) return { valid: true };

  // Text and mixed messages must have E2EE encryption fields present
  const e2ee = data.e2ee || {};
  const missing = [];

  if (!e2ee.nonce && !data.nonce) {
    missing.push('nonce');
  }
  if (!e2ee.ephemeralPublicKey && !data.ephemeralPublicKey) {
    missing.push('ephemeralPublicKey');
  }

  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Missing E2EE fields: ${missing.join(', ')}`
    };
  }
  return { valid: true };
}

function normalizeRecoveryKey(key) {
  if (!key) return '';
  return key.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Used by the pre-login password-reset flow (/api/reset-password) to decide
 * whether a client-submitted "recovery" — a re-derived publicKey/
 * encryptedPrivateKey/recoveryKeyHash, computed client-side from whatever
 * recovery phrase the user just typed — actually recovers THIS account's
 * existing E2EE identity, or is an unrelated keypair derived from a wrong
 * (but still well-formed) phrase.
 *
 * The recovery phrase itself is never sent to or seen by the server — only
 * its SHA-256 hash. That hash was recorded once, at the moment the account's
 * REAL key was created, and is never supposed to change just because someone
 * later submits a different phrase. Comparing the freshly-submitted hash
 * against that untouched, previously-stored value is what cryptographically
 * binds "this recovery attempt" to "the account's actual identity" — before
 * this check existed, the submitted hash was only ever used to overwrite the
 * stored one, never to verify against it, so ANY well-formed phrase (right
 * or wrong) was accepted and silently replaced the real key.
 *
 * @param {{ existingRecoveryKeyHash: string|null, existingPublicKey: string|null,
 *           submittedRecoveryKeyHash: string, submittedPublicKey: string }} args
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function verifyRecoveryIdentityMatch({ existingRecoveryKeyHash, existingPublicKey, submittedRecoveryKeyHash, submittedPublicKey }) {
  // Primary check: If an existing public key is on file, comparing the public key
  // derived from the submitted recovery phrase against stored public key is exact
  // mathematical verification.
  if (existingPublicKey) {
    if (submittedPublicKey === existingPublicKey) {
      return { ok: true };
    }
    return { ok: false, reason: 'publickey-mismatch' };
  }

  // Secondary check: If no public key on file, check stored recoveryKeyHash
  if (existingRecoveryKeyHash) {
    if (submittedRecoveryKeyHash === existingRecoveryKeyHash) {
      return { ok: true };
    }
    return { ok: false, reason: 'hash-mismatch' };
  }

  // Fallback: If neither exists in DB, allow setup
  return { ok: true };
}

/**
 * Sanitizes a client-supplied replyTo object before it is ever persisted or
 * broadcast. sanitizeReplyToForWire (frontend/src/lib/crypto.js) already
 * strips this down to a safe preview on the client — see its own comment,
 * "the reply-preview privacy fix" — but the server must not trust that a
 * client actually did so. /api/chats/send previously stored whatever shape
 * of replyTo the request body carried, verbatim and with no field allowlist,
 * which would silently reopen the original plaintext-reply-preview leak the
 * moment any client (a modified one, or a future regression) sent a raw
 * `.message` field again. Only these four fields are ever safe to keep —
 * none of them are message content, matching the same policy the Socket.io
 * group-chat handler's own replyTo allowlist uses for id/username/mediaType/
 * mediaFileName.
 *
 * @param {*} replyTo - the client-supplied replyTo value, of unknown shape
 * @returns {{id: *, username: string|null, mediaType: string|null, mediaFileName: string|null} | null}
 */
function sanitizeReplyToServer(replyTo) {
  if (!replyTo || typeof replyTo !== 'object') return null;
  return {
    id: replyTo.id ?? null,
    username: typeof replyTo.username === 'string' ? replyTo.username.slice(0, 60) : null,
    mediaType: typeof replyTo.mediaType === 'string' ? replyTo.mediaType.slice(0, 100) : null,
    mediaFileName: typeof replyTo.mediaFileName === 'string' ? replyTo.mediaFileName.slice(0, 255) : null,
  };
}

module.exports = {
  validateE2EEMessage,
  normalizeRecoveryKey,
  verifyRecoveryIdentityMatch,
  sanitizeReplyToServer
};
