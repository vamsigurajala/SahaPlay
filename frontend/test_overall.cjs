const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

function encodeBase64(u8) { return util.encodeBase64(u8); }
function robustDecode(b64) { return util.decodeBase64(b64.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')); }
function encodeUTF8(u8) { return util.encodeUTF8(u8); }
function decodeUTF8(s) { return util.decodeUTF8(s); }

// mimic encryptDM
function encryptDM(messageText, recipientPublicKeyBase64, senderPublicKeyBase64) {
  const messageUint8  = decodeUTF8(messageText);
  const recipientPK   = robustDecode(recipientPublicKeyBase64);
  const ephemeral = nacl.box.keyPair();
  const nonce     = nacl.randomBytes(nacl.box.nonceLength);
  
  const ciphertext = nacl.box(messageUint8, nonce, recipientPK, ephemeral.secretKey);
  
  let senderCiphertext = null;
  if (senderPublicKeyBase64) {
    const senderPK = robustDecode(senderPublicKeyBase64);
    const sc = nacl.box(messageUint8, nonce, senderPK, ephemeral.secretKey);
    if (sc) senderCiphertext = encodeBase64(sc);
  }
  
  return {
    ciphertext:         encodeBase64(ciphertext),
    nonce:              encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeral.publicKey),
    senderCiphertext
  };
}

// mimic decryptDM
function decryptDM(ciphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64) {
  try {
    const ciphertext  = robustDecode(ciphertextBase64);
    const nonce       = robustDecode(nonceBase64);
    const ephemeralPK = robustDecode(ephemeralPublicKeyBase64);
    const myPrivKey   = robustDecode(myPrivateKeyBase64);
    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPK, myPrivKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch (e) {
    return null;
  }
}

// mimic decryptDMSenderCopy
function decryptDMSenderCopy(senderCiphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64) {
  return decryptDM(senderCiphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64);
}

const senderKp = nacl.box.keyPair();
const receiverKp = nacl.box.keyPair();

const msg = "Hello from sender";
const enc = encryptDM(msg, encodeBase64(receiverKp.publicKey), encodeBase64(senderKp.publicKey));
console.log("Encrypted:", enc);

const dec_receiver = decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(receiverKp.secretKey));
console.log("Dec_Receiver:", dec_receiver);

const dec_sender = decryptDMSenderCopy(enc.senderCiphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(senderKp.secretKey));
console.log("Dec_Sender:", dec_sender);

