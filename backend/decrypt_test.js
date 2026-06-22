const { Pool } = require('pg');
const crypto = require('crypto');
const nacl = require('../frontend/node_modules/tweetnacl');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function b64ToBuf(b64) {
  return Buffer.from(b64, 'base64');
}

function encodeBase64(u8) {
  return Buffer.from(u8).toString('base64');
}

async function decryptPrivateKeyNode(blob64, password) {
  try {
    const packed = b64ToBuf(blob64);
    const salt = packed.subarray(0, 16);
    const iv = packed.subarray(16, 16 + 12);
    const cipher = packed.subarray(16 + 12);

    const aesKeyBytes = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');

    const tag = cipher.subarray(cipher.length - 16);
    const encrypted = cipher.subarray(0, cipher.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBytes, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return new Uint8Array(decrypted);
  } catch (err) {
    return null;
  }
}

// Mimic decryptDM
function decryptDM(ciphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64) {
  try {
    const ciphertext = b64ToBuf(ciphertextBase64);
    const nonce = b64ToBuf(nonceBase64);
    const ephemeralPK = b64ToBuf(ephemeralPublicKeyBase64);
    const myPrivKey = b64ToBuf(myPrivateKeyBase64);
    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPK, myPrivKey);
    if (!decrypted) return null;
    return Buffer.from(decrypted).toString('utf8');
  } catch (e) {
    return null;
  }
}

async function main() {
  try {
    // 1. Get krish's secret key
    const userRes = await pool.query('SELECT "encryptedPrivateKey" FROM users WHERE username = \'krish\'');
    const krishEncPriv = userRes.rows[0].encryptedPrivateKey;
    const krishSecretKey = await decryptPrivateKeyNode(krishEncPriv, 'Vfstr#pps7');
    if (!krishSecretKey) {
      console.log('Could not decrypt krish private key');
      return;
    }
    const krishSecretKeyB64 = encodeBase64(krishSecretKey);

    // 2. Query private messages between krish and vamsi
    const msgRes = await pool.query(`
      SELECT id, "senderName", "targetName", message, "senderMessage", nonce, "ephemeralPublicKey", "mediaUrl", "mediaType"
      FROM messages
      WHERE type = 'private' AND (
        ("senderName" = 'krish' AND "targetName" = 'vamsi') OR
        ("senderName" = 'vamsi' AND "targetName" = 'krish')
      )
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    console.log(`\n=== Decryption Test using KRISH's Private Key ===`);
    for (const msg of msgRes.rows) {
      const isMine = msg.senderName === 'krish';
      let decrypted = null;
      if (isMine) {
        // Decrypt sender copy
        if (msg.senderMessage && msg.nonce && msg.ephemeralPublicKey) {
          decrypted = decryptDM(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, krishSecretKeyB64);
        }
      } else {
        // Decrypt recipient copy
        if (msg.message && msg.nonce && msg.ephemeralPublicKey) {
          decrypted = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, krishSecretKeyB64);
        }
      }
      console.log(`\nMsg ID: ${msg.id}`);
      console.log(`From: ${msg.senderName} To: ${msg.targetName}`);
      console.log(`Decrypted Text: ${decrypted ? `"${decrypted}"` : '❌ FAILED'}`);
      if (msg.mediaUrl) {
        console.log(`Media URL: ${msg.mediaUrl}`);
        console.log(`Media Type: ${msg.mediaType}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

main();
