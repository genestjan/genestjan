package com.genestjanramirez.money;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.security.KeyStore;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Fingerprint unlock. The vault key is encrypted with a key that lives in the phone's secure
 * hardware and only works after a fingerprint or face match. Adding a new fingerprint to the
 * phone invalidates it, so the password is needed again.
 */
final class BioVault {
    interface Result {
        void ok(String secret);
        void fail(String message);
    }

    private static final String ALIAS = "money_hub_unlock";
    private static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_STRONG;

    private BioVault() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("bio", Context.MODE_PRIVATE);
    }

    static boolean available(Context c) {
        return BiometricManager.from(c).canAuthenticate(AUTH) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    static boolean enrolled(Context c) {
        return prefs(c).contains("ct");
    }

    static void clear(Context c) {
        prefs(c).edit().clear().apply();
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            ks.deleteEntry(ALIAS);
        } catch (Exception ignored) {
            // nothing to delete
        }
    }

    private static SecretKey newKey() throws Exception {
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);
        if (Build.VERSION.SDK_INT >= 30) b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        kg.init(b.build());
        return kg.generateKey();
    }

    private static SecretKey existingKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    private static BiometricPrompt.PromptInfo info(String title) {
        return new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle("Money Hub")
                .setNegativeButtonText("Use password")
                .setAllowedAuthenticators(AUTH)
                .build();
    }

    private static BiometricPrompt prompt(FragmentActivity a, Result r, CipherStep onSuccess) {
        return new BiometricPrompt(a, ContextCompat.getMainExecutor(a), new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                try {
                    BiometricPrompt.CryptoObject co = result.getCryptoObject();
                    if (co == null || co.getCipher() == null) throw new IllegalStateException("No key");
                    onSuccess.run(co.getCipher());
                } catch (Exception e) {
                    r.fail("Fingerprint unlock did not work. Use your password.");
                }
            }

            @Override
            public void onAuthenticationError(int code, @NonNull CharSequence message) {
                boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                        || code == BiometricPrompt.ERROR_CANCELED;
                r.fail(cancelled ? "cancelled" : message.toString());
            }
        });
    }

    private interface CipherStep {
        void run(Cipher c) throws Exception;
    }

    /** Must run on the main thread. */
    static void enroll(FragmentActivity a, String secretB64, Result r) {
        try {
            clear(a);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, newKey());
            prompt(a, r, cipher -> {
                byte[] ct = cipher.doFinal(Base64.getDecoder().decode(secretB64));
                prefs(a).edit()
                        .putString("iv", Base64.getEncoder().encodeToString(cipher.getIV()))
                        .putString("ct", Base64.getEncoder().encodeToString(ct))
                        .apply();
                r.ok("");
            }).authenticate(info("Turn on fingerprint unlock"), new BiometricPrompt.CryptoObject(c));
        } catch (Exception e) {
            r.fail("This phone could not set up fingerprint unlock.");
        }
    }

    /** Must run on the main thread. */
    static void unlock(FragmentActivity a, Result r) {
        try {
            String iv = prefs(a).getString("iv", null), ct = prefs(a).getString("ct", null);
            SecretKey key = existingKey();
            if (iv == null || ct == null || key == null) {
                r.fail("Fingerprint unlock is not set up on this phone.");
                return;
            }
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.getDecoder().decode(iv)));
            prompt(a, r, cipher -> r.ok(Base64.getEncoder().encodeToString(cipher.doFinal(Base64.getDecoder().decode(ct)))))
                    .authenticate(info("Unlock Money Hub"), new BiometricPrompt.CryptoObject(c));
        } catch (KeyPermanentlyInvalidatedException e) {
            clear(a);
            r.fail("Your fingerprints changed, so fingerprint unlock was turned off. Unlock with your password, then turn it on again in Settings.");
        } catch (Exception e) {
            r.fail("Fingerprint unlock did not work. Use your password.");
        }
    }
}
