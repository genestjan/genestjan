package com.genestjanramirez.money;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/**
 * What the capture service keeps on the phone, all in Money Hub's private storage:
 * the list of apps to listen to, which apps post notifications (names and counts only, never
 * content), the public key and cloud drop-off details, and a queue of sealed captures.
 */
final class CaptureStore {
    static final String[] DEFAULT_APPS = {
            "com.globe.gcash.android", "com.paymaya", "com.paypal.android.p2pmobile", "com.transferwise.android",
            "com.bpi.ng.app", "ph.com.bdo.retail", "com.unionbankph.online", "com.metrobank.mobile",
            "com.securitybank.mobile", "ph.gotyme.app",
            "com.samsung.android.messaging", "com.google.android.apps.messaging",
    };
    static final Set<String> SMS_APPS = new HashSet<>(Arrays.asList(
            "com.samsung.android.messaging", "com.google.android.apps.messaging", "com.android.mms"));

    private static CaptureStore instance;
    private final SharedPreferences prefs;
    private final File queueDir;

    private CaptureStore(Context ctx) {
        Context app = ctx.getApplicationContext();
        prefs = app.getSharedPreferences("capture", Context.MODE_PRIVATE);
        queueDir = new File(app.getFilesDir(), "capture-queue");
        //noinspection ResultOfMethodCallIgnored
        queueDir.mkdirs();
    }

    static synchronized CaptureStore get(Context ctx) {
        if (instance == null) instance = new CaptureStore(ctx);
        return instance;
    }

    // ---- Apps to listen to ----

    synchronized Set<String> allowlist() {
        Set<String> s = prefs.getStringSet("allow", null);
        return s == null ? new HashSet<>(Arrays.asList(DEFAULT_APPS)) : new HashSet<>(s);
    }

    synchronized void setAllowlist(Set<String> packages) {
        prefs.edit().putStringSet("allow", new HashSet<>(packages)).apply();
    }

    boolean allowed(String pkg) {
        return allowlist().contains(pkg);
    }

    /** Remembers that an app posts notifications: its package, label and a count. No content. */
    synchronized void noteSeen(String pkg, String label) {
        try {
            JSONObject seen = new JSONObject(prefs.getString("seen", "{}"));
            JSONObject e = seen.optJSONObject(pkg);
            if (e == null) e = new JSONObject();
            e.put("label", label);
            e.put("count", e.optInt("count") + 1);
            e.put("lastAt", System.currentTimeMillis());
            seen.put(pkg, e);
            if (seen.length() > 80) seen.remove(oldest(seen));
            prefs.edit().putString("seen", seen.toString()).apply();
        } catch (JSONException ignored) {
            // a bad record is not worth crashing the listener over
        }
    }

    private static String oldest(JSONObject seen) {
        String key = null;
        long at = Long.MAX_VALUE;
        for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
            String k = it.next();
            long t = seen.optJSONObject(k) == null ? 0 : seen.optJSONObject(k).optLong("lastAt");
            if (t < at) { at = t; key = k; }
        }
        return key;
    }

    synchronized JSONArray seen() throws JSONException {
        JSONObject seen = new JSONObject(prefs.getString("seen", "{}"));
        JSONArray out = new JSONArray();
        for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
            String k = it.next();
            JSONObject e = seen.getJSONObject(k);
            out.put(new JSONObject().put("pkg", k).put("label", e.optString("label", k))
                    .put("count", e.optInt("count")).put("lastAt", e.optLong("lastAt")));
        }
        return out;
    }

    // ---- Keys and cloud drop-off ----

    synchronized void configure(String publicKey, String url, String anonKey, String dropToken) {
        SharedPreferences.Editor e = prefs.edit().putString("publicKey", publicKey);
        if (url != null && anonKey != null && dropToken != null) {
            e.putString("url", url).putString("anonKey", anonKey).putString("dropToken", dropToken);
        } else {
            e.remove("url").remove("anonKey").remove("dropToken");
        }
        e.apply();
    }

    String publicKey() { return prefs.getString("publicKey", null); }
    String url() { return prefs.getString("url", null); }
    String anonKey() { return prefs.getString("anonKey", null); }
    String dropToken() { return prefs.getString("dropToken", null); }

    // ---- The sealed queue ----

    static final class Item {
        final String id;
        final long postedAt;
        final String box;

        Item(String id, long postedAt, String box) {
            this.id = id;
            this.postedAt = postedAt;
            this.box = box;
        }
    }

    synchronized void enqueue(String id, long postedAt, String sealedJson) throws Exception {
        File f = new File(queueDir, id + ".json");
        String body = new JSONObject().put("id", id).put("postedAt", postedAt).put("box", new JSONObject(sealedJson)).toString();
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(body.getBytes(StandardCharsets.UTF_8));
        }
    }

    synchronized List<Item> queue() {
        List<Item> out = new ArrayList<>();
        File[] files = queueDir.listFiles((d, n) -> n.endsWith(".json"));
        if (files == null) return out;
        Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
        for (File f : files) {
            try {
                JSONObject o = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
                out.add(new Item(o.getString("id"), o.optLong("postedAt"), o.getJSONObject("box").toString()));
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        return out;
    }

    synchronized void remove(String id) {
        if (!id.matches("[0-9a-fA-F-]{36}")) return;
        //noinspection ResultOfMethodCallIgnored
        new File(queueDir, id + ".json").delete();
    }

    synchronized int queued() {
        File[] files = queueDir.listFiles((d, n) -> n.endsWith(".json"));
        return files == null ? 0 : files.length;
    }
}
