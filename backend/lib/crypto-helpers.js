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

module.exports = {
  validateE2EEMessage,
  normalizeRecoveryKey
};
