package com.genestjanramirez.money;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Reads notifications from the bank, card and e-wallet apps (and bank texts) you allow, and
 * seals each money-related one for Money Hub. Everything else is ignored on the spot: only the
 * name of the app is noted, so the Capture screen can offer it in the list.
 */
public class CaptureService extends NotificationListenerService {

    // Never stored, whatever app they come from.
    static final Pattern OTP = Pattern.compile(
            "\\b(otp|one[- ]?time\\s*(pin|password|passcode|code)|verification code|authentication code|security code|passcode|do not share|never share|don'?t share)\\b",
            Pattern.CASE_INSENSITIVE);

    // Something that looks like an amount of money.
    static final Pattern MONEY = Pattern.compile(
            "(php|usd|eur|gbp|sgd|aud|₱|\\$|€|£|(?<![a-z])p)\\s?\\d|\\d[\\d,]*(\\.\\d{1,2})?\\s?(php|usd)\\b",
            Pattern.CASE_INSENSITIVE);

    // A bank text comes from a bank's name, never from a person or a phone number.
    static final Pattern BANK_SENDER = Pattern.compile(
            "\\b(g-?cash|maya|paymaya|bpi|bdo|union\\s?bank|ubp|metro\\s?bank|security\\s?bank|rcbc|pnb|land\\s?bank|east\\s?west|"
                    + "china\\s?bank|go\\s?tyme|sea\\s?bank|cimb|citi|home\\s?credit|psbank|aub|tonik|paypal|wise|shopeepay|maribank|komo)",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, Long> RECENT = new LinkedHashMap<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            CaptureStore store = CaptureStore.get(this);
            store.noteSeen(pkg, label(pkg));
            if (!store.allowed(pkg)) return;

            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle ex = n.extras;
            String title = text(ex.getCharSequence(Notification.EXTRA_TITLE));
            String body = bestText(ex);
            if (body.isEmpty()) return;
            String all = title + " " + body;
            if (OTP.matcher(all).find()) return;
            if (!MONEY.matcher(body).find()) return;
            if (CaptureStore.SMS_APPS.contains(pkg)
                    && !BANK_SENDER.matcher(title).find()
                    && !BANK_SENDER.matcher(body.length() > 40 ? body.substring(0, 40) : body).find()) {
                return;
            }
            if (seenRecently(pkg + "|" + title + "|" + body, sbn.getPostTime())) return;

            String key = store.publicKey();
            if (key == null) return; // Money Hub has not been set up on this phone yet

            String id = UUID.randomUUID().toString();
            JSONObject plain = new JSONObject()
                    .put("id", id).put("pkg", pkg).put("app", label(pkg))
                    .put("title", title).put("text", body).put("postedAt", sbn.getPostTime());
            store.enqueue(id, sbn.getPostTime(), CaptureCrypto.seal(key, plain.toString()));
            Uploader.flushSoon(this);
        } catch (Throwable ignored) {
            // The listener must never crash: Android would stop sending notifications to it.
        }
    }

    /** The same text often arrives twice (an update to the notification). Keep it once. */
    private static synchronized boolean seenRecently(String key, long at) {
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<String, Long>> it = RECENT.entrySet().iterator(); it.hasNext(); ) {
            if (now - it.next().getValue() > 10 * 60_000L) it.remove();
        }
        if (RECENT.containsKey(key)) return true;
        RECENT.put(key, at > 0 ? Math.max(at, now - 60_000L) : now);
        return false;
    }

    private String label(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String text(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }

    /** The fullest version of the message: big text, then the inbox lines, then the short text. */
    static String bestText(Bundle ex) {
        String big = text(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (!big.isEmpty()) return big;
        Parcelable[] messages = ex.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0 && messages[messages.length - 1] instanceof Bundle) {
            String last = text(((Bundle) messages[messages.length - 1]).getCharSequence("text"));
            if (!last.isEmpty()) return last;
        }
        CharSequence[] lines = ex.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null && lines.length > 0) return text(lines[lines.length - 1]);
        return text(ex.getCharSequence(Notification.EXTRA_TEXT));
    }
}
