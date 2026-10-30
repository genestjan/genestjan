package com.genestjanramirez.money;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Seals a captured notification so only an unlocked Money Hub can read it: a fresh P-256 key
 * agreement with the app's public key, HKDF-SHA256, then AES-256-GCM. The same steps as
 * sealCapture() in money/web/src/lib/crypto.ts, which opens it.
 */
final class CaptureCrypto {
    private static final byte[] INFO = "money-hub capture v1".getBytes(StandardCharsets.UTF_8);
    private static final SecureRandom RANDOM = new SecureRandom();

    private CaptureCrypto() {}

    /** Returns {"v":1,"epk":...,"iv":...,"ct":...} as JSON text. */
    static String seal(String publicKeySpki, String plaintext) throws Exception {
        Base64.Encoder b64 = Base64.getEncoder();
        PublicKey recipient = KeyFactory.getInstance("EC")
                .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeySpki)));

        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        KeyPair eph = gen.generateKeyPair();

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(eph.getPrivate());
        ka.doPhase(recipient, true);
        byte[] shared = ka.generateSecret();

        byte[] epk = rawPoint((ECPublicKey) eph.getPublic());
        byte[] key = hkdf(shared, epk, INFO);
        byte[] iv = new byte[12];
        RANDOM.nextBytes(iv);

        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] ct = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        Arrays.fill(shared, (byte) 0);
        Arrays.fill(key, (byte) 0);

        return "{\"v\":1,\"epk\":\"" + b64.encodeToString(epk) + "\",\"iv\":\"" + b64.encodeToString(iv)
                + "\",\"ct\":\"" + b64.encodeToString(ct) + "\"}";
    }

    /** Uncompressed point: 0x04 || X || Y, each 32 bytes. */
    static byte[] rawPoint(ECPublicKey k) {
        byte[] out = new byte[65];
        out[0] = 4;
        copy32(k.getW().getAffineX(), out, 1);
        copy32(k.getW().getAffineY(), out, 33);
        return out;
    }

    private static void copy32(BigInteger v, byte[] out, int at) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, at + 32 - len, len);
    }

    /** RFC 5869 HKDF-SHA256 with one block of output (32 bytes). */
    static byte[] hkdf(byte[] ikm, byte[] salt, byte[] info) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return mac.doFinal();
    }
}
