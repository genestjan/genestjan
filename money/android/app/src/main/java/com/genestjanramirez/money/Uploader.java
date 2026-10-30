package com.genestjanramirez.money;

import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Drops sealed captures into the cloud inbox, so the laptop sees a payment within seconds even
 * while Money Hub on the phone is closed. The phone's token can add to the inbox and nothing
 * else; what it adds is already sealed.
 */
final class Uploader {
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    private Uploader() {}

    static void flushSoon(Context ctx) {
        Context app = ctx.getApplicationContext();
        IO.execute(() -> flush(app));
    }

    private static void flush(Context ctx) {
        CaptureStore store = CaptureStore.get(ctx);
        String url = store.url(), key = store.anonKey(), token = store.dropToken();
        if (url == null || key == null || token == null) return;
        for (CaptureStore.Item item : store.queue()) {
            try {
                int status = post(url + "/rest/v1/rpc/money_drop", key,
                        new JSONObject().put("p_token", token).put("p_payload", new JSONObject(item.box)).toString());
                if (status >= 200 && status < 300) store.remove(item.id);
                else return; // try again later; the item stays sealed in the queue
            } catch (Exception e) {
                return; // offline
            }
        }
    }

    private static int post(String endpoint, String apiKey, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(15_000);
            c.setReadTimeout(20_000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("apikey", apiKey);
            // Older keys are JWTs and go in Authorization too; new publishable keys do not.
            if (apiKey.startsWith("eyJ")) c.setRequestProperty("Authorization", "Bearer " + apiKey);
            try (OutputStream out = c.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
            return c.getResponseCode();
        } finally {
            c.disconnect();
        }
    }
}
