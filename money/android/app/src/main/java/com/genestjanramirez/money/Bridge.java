package com.genestjanramirez.money;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Answers the shared screen. Messages are only accepted from Money Hub's own page (the origin
 * rule in MainActivity), and replies go back the same way. Same protocol as the Windows app.
 */
final class Bridge implements WebViewCompat.WebMessageListener {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final Set<String> HTTP_HOSTS = new HashSet<>();
    static {
        HTTP_HOSTS.add("api-m.paypal.com");
        HTTP_HOSTS.add("api-m.sandbox.paypal.com");
    }

    private final MainActivity activity;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private JavaScriptReplyProxy proxy;

    Bridge(MainActivity activity) {
        this.activity = activity;
    }

    @Override
    public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin,
                              boolean isMainFrame, @NonNull JavaScriptReplyProxy replyProxy) {
        if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
        proxy = replyProxy;
        int id = 0;
        try {
            JSONObject msg = new JSONObject(String.valueOf(message.getData()));
            id = msg.optInt("id");
            JSONObject params = msg.optJSONObject("params");
            handle(id, msg.optString("method"), params == null ? new JSONObject() : params);
        } catch (Exception e) {
            fail(id, e.getMessage() == null ? "Something went wrong." : e.getMessage());
        }
    }

    private void handle(int id, String method, JSONObject p) throws Exception {
        CaptureStore store = CaptureStore.get(activity);
        switch (method) {
            case "hello":
            case "info":
                reply(id, new JSONObject().put("platform", "android").put("version", BuildConfig.VERSION_NAME));
                break;
            case "bio.status":
                reply(id, new JSONObject().put("available", BioVault.available(activity))
                        .put("enrolled", BioVault.enrolled(activity)).put("label", "Fingerprint"));
                break;
            case "bio.enroll":
                BioVault.enroll(activity, p.getString("secret"), result(id));
                break;
            case "bio.unlock":
                BioVault.unlock(activity, new BioVault.Result() {
                    @Override public void ok(String secret) { reply(id, json(() -> new JSONObject().put("secret", secret))); }
                    @Override public void fail(String message) { Bridge.this.fail(id, message); }
                });
                break;
            case "bio.clear":
                BioVault.clear(activity);
                reply(id, null);
                break;
            case "capture.status": {
                JSONArray allow = new JSONArray();
                for (String s : store.allowlist()) allow.put(s);
                boolean access = NotificationManagerCompat.getEnabledListenerPackages(activity).contains(activity.getPackageName());
                reply(id, new JSONObject().put("access", access).put("allowlist", allow).put("seen", store.seen())
                        .put("queued", store.queued()).put("configured", store.publicKey() != null));
                break;
            }
            case "capture.openAccess":
                activity.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                reply(id, null);
                break;
            case "capture.openBattery":
                openBattery();
                reply(id, null);
                break;
            case "capture.setAllowlist": {
                Set<String> pkgs = new HashSet<>();
                JSONArray a = p.getJSONArray("packages");
                for (int i = 0; i < a.length(); i++) pkgs.add(a.getString(i));
                store.setAllowlist(pkgs);
                reply(id, null);
                break;
            }
            case "capture.configure":
                store.configure(p.getString("publicKey"), opt(p, "supabaseUrl"), opt(p, "anonKey"), opt(p, "dropToken"));
                Uploader.flushSoon(activity);
                reply(id, null);
                break;
            case "capture.read": {
                JSONArray items = new JSONArray();
                for (CaptureStore.Item it : store.queue()) {
                    items.put(new JSONObject().put("id", it.id).put("postedAt", it.postedAt).put("box", new JSONObject(it.box)));
                }
                reply(id, new JSONObject().put("items", items));
                Uploader.flushSoon(activity);
                break;
            }
            case "capture.ack": {
                JSONArray ids = p.getJSONArray("ids");
                for (int i = 0; i < ids.length(); i++) store.remove(ids.getString(i));
                reply(id, null);
                break;
            }
            case "http":
                http(id, p);
                break;
            case "file.save":
                activity.saveFile(p.getString("name"), p.getString("mime"), p.getString("data"),
                        "base64".equals(p.optString("encoding")), saved -> reply(id, json(() -> new JSONObject().put("saved", saved))));
                break;
            case "open": {
                Uri u = Uri.parse(p.getString("url"));
                if (!"https".equals(u.getScheme())) throw new IllegalArgumentException("Only https links open.");
                activity.startActivity(new Intent(Intent.ACTION_VIEW, u));
                reply(id, null);
                break;
            }
            default:
                fail(id, "Unknown request: " + method);
        }
    }

    private static String opt(JSONObject p, String key) {
        return p.isNull(key) ? null : p.optString(key, null);
    }

    private void openBattery() {
        PowerManager pm = (PowerManager) activity.getSystemService(android.content.Context.POWER_SERVICE);
        String pkg = activity.getPackageName();
        try {
            if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                activity.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg)));
                return;
            }
        } catch (ActivityNotFoundException ignored) {
            // fall through to the app's own settings page
        }
        activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
    }

    /** PayPal does not accept calls from a web page, so the app makes them. Only PayPal hosts. */
    private void http(int id, JSONObject p) {
        io.execute(() -> {
            HttpURLConnection c = null;
            try {
                URL url = new URL(p.getString("url"));
                if (!"https".equals(url.getProtocol()) || !HTTP_HOSTS.contains(url.getHost())) throw new IllegalArgumentException("That address is not allowed.");
                c = (HttpURLConnection) url.openConnection();
                c.setRequestMethod(p.optString("method", "GET"));
                c.setConnectTimeout(20_000);
                c.setReadTimeout(60_000);
                JSONObject headers = p.optJSONObject("headers");
                if (headers != null) {
                    for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                        String k = it.next();
                        c.setRequestProperty(k, headers.getString(k));
                    }
                }
                String body = opt(p, "body");
                if (body != null) {
                    c.setDoOutput(true);
                    try (OutputStream out = c.getOutputStream()) {
                        out.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }
                int status = c.getResponseCode();
                InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                String text = in == null ? "" : read(in);
                reply(id, new JSONObject().put("status", status).put("body", text));
            } catch (Exception e) {
                fail(id, "Could not reach PayPal. Check your internet connection.");
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private static String read(InputStream in) throws Exception {
        try (InputStream s = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    // ---- Replies and events ----

    private interface JsonMaker {
        Object make() throws JSONException;
    }

    private static Object json(JsonMaker m) {
        try {
            return m.make();
        } catch (JSONException e) {
            return null;
        }
    }

    private BioVault.Result result(int id) {
        return new BioVault.Result() {
            @Override public void ok(String secret) { reply(id, null); }
            @Override public void fail(String message) { Bridge.this.fail(id, message); }
        };
    }

    void reply(int id, Object result) {
        try {
            send(new JSONObject().put("id", id).put("ok", true).put("result", result == null ? JSONObject.NULL : result));
        } catch (JSONException ignored) {
            // cannot happen with these values
        }
    }

    void fail(int id, String error) {
        try {
            send(new JSONObject().put("id", id).put("ok", false).put("error", error));
        } catch (JSONException ignored) {
            // cannot happen with these values
        }
    }

    void emit(String event) {
        try {
            send(new JSONObject().put("event", event));
        } catch (JSONException ignored) {
            // cannot happen with these values
        }
    }

    private void send(JSONObject o) {
        activity.runOnUiThread(() -> {
            if (proxy != null) proxy.postMessage(o.toString());
        });
    }
}
