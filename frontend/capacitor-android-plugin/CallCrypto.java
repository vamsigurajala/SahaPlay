package com.sahaplay.app;

import android.util.Base64;

import com.goterl.lazysodium.LazySodiumAndroid;
import com.goterl.lazysodium.SodiumAndroid;
import com.goterl.lazysodium.interfaces.Box;

import java.nio.charset.StandardCharsets;

// NaCl box (X25519-XSalsa20-Poly1305) encrypt/decrypt, bit-compatible with
// the frontend's TweetNaCl-based encryptDM/decryptDM (see
// frontend/src/lib/crypto.js) — the same construction libsodium calls
// crypto_box_easy. Every call-signaling payload (offer/answer/ICE) on the
// wire uses this exact scheme: a fresh ephemeral X25519 keypair per message
// for forward secrecy, encrypted to the recipient's long-term public key.
// This is Phase 2's single highest-risk piece (see the plan doc) — a
// mismatch here fails silently (garbage plaintext / null) with nothing to
// distinguish it from a plain wiring bug, which is why the encrypt/decrypt
// shape below mirrors crypto.js's encryptDM/decryptDM field-for-field.
public class CallCrypto {

    public static class Envelope {
        public final String ciphertext;
        public final String nonce;
        public final String ephemeralPublicKey;

        Envelope(String ciphertext, String nonce, String ephemeralPublicKey) {
            this.ciphertext = ciphertext;
            this.nonce = nonce;
            this.ephemeralPublicKey = ephemeralPublicKey;
        }
    }

    private final LazySodiumAndroid sodium;

    public CallCrypto() {
        this.sodium = new LazySodiumAndroid(new SodiumAndroid());
    }

    // Encrypts plaintext for recipientPublicKey (32 raw bytes), generating a
    // fresh ephemeral keypair — mirrors crypto.js's encryptDM() (minus the
    // senderCiphertext side-channel, which call signaling never reads back).
    public Envelope encrypt(String plaintext, byte[] recipientPublicKey) throws Exception {
        if (recipientPublicKey == null || recipientPublicKey.length != Box.PUBLICKEYBYTES) {
            throw new IllegalArgumentException("recipient public key must be " + Box.PUBLICKEYBYTES + " bytes");
        }
        byte[] ephemeralPk = new byte[Box.PUBLICKEYBYTES];
        byte[] ephemeralSk = new byte[Box.SECRETKEYBYTES];
        if (!sodium.cryptoBoxKeypair(ephemeralPk, ephemeralSk)) {
            throw new RuntimeException("ephemeral keypair generation failed");
        }

        byte[] nonce = sodium.randomBytesBuf(Box.NONCEBYTES);
        byte[] message = plaintext.getBytes(StandardCharsets.UTF_8);
        byte[] cipherText = new byte[Box.MACBYTES + message.length];
        boolean ok = sodium.cryptoBoxEasy(cipherText, message, message.length, nonce, recipientPublicKey, ephemeralSk);
        if (!ok) throw new RuntimeException("box encrypt failed");

        return new Envelope(
            Base64.encodeToString(cipherText, Base64.NO_WRAP),
            Base64.encodeToString(nonce, Base64.NO_WRAP),
            Base64.encodeToString(ephemeralPk, Base64.NO_WRAP)
        );
    }

    // Decrypts a received envelope using our own long-term secret key.
    // Returns null on any failure (bad key, tampered ciphertext, wrong
    // recipient) — callers treat that as "drop the message", matching
    // decryptDM()'s null-on-failure contract exactly.
    public String decrypt(String ciphertextB64, String nonceB64, String ephemeralPublicKeyB64, byte[] mySecretKey) {
        try {
            if (ciphertextB64 == null || nonceB64 == null || ephemeralPublicKeyB64 == null) return null;
            if (mySecretKey == null || mySecretKey.length != Box.SECRETKEYBYTES) return null;

            byte[] cipherText = Base64.decode(ciphertextB64, Base64.NO_WRAP);
            byte[] nonce = Base64.decode(nonceB64, Base64.NO_WRAP);
            byte[] ephemeralPk = Base64.decode(ephemeralPublicKeyB64, Base64.NO_WRAP);
            if (ephemeralPk.length != Box.PUBLICKEYBYTES) return null;
            if (cipherText.length < Box.MACBYTES) return null;

            byte[] message = new byte[cipherText.length - Box.MACBYTES];
            boolean ok = sodium.cryptoBoxOpenEasy(message, cipherText, cipherText.length, nonce, ephemeralPk, mySecretKey);
            if (!ok) return null;
            return new String(message, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
