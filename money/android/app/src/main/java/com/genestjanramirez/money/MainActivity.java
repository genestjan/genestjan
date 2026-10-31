package com.genestjanramirez.money;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;

/**
 * Hosts the shared Money Hub screen (money/web, packed into assets/web) and lets it use the
 * phone: notification capture, fingerprint unlock, saving files and PayPal calls.
 */
public class MainActivity extends FragmentActivity {
    private static final String START = Bridge.ORIGIN + "/assets/web/index.html";

    interface Saved {
        void done(boolean saved);
    }

    interface Granted {
        void done(boolean granted);
    }

    private WebView web;
    private Bridge bridge;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;
    private Saved pendingSaved;
    private ActivityResultLauncher<Intent> pickFile;
    private ActivityResultLauncher<Intent> createFile;
    private ActivityResultLauncher<String> notificationPermission;
    private Granted pendingGranted;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Screenshots are allowed, so a problem can be captured and sent; Settings > Security >
        // Allow screenshots turns them off (setSecure). The recent apps list still shows a blank
        // card instead of your balances (Android 13 and later).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(false);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);

        pickFile = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), this::onFilePicked);
        createFile = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), this::onFileCreated);
        notificationPermission = registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            Granted g = pendingGranted;
            pendingGranted = null;
            if (g != null) g.done(Reminders.allowed(this));
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#06080D"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#06080D"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(@NonNull WebView view, @NonNull WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                // Anything else opens in the browser, never inside Money Hub.
                if ("https".equals(u.getScheme())) startActivity(new Intent(Intent.ACTION_VIEW, u));
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                recreate();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                        .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "application/octet-stream"});
                pickFile.launch(Intent.createChooser(i, "Choose a CSV file"));
                return true;
            }
        });

        bridge = new Bridge(this);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "MoneyHubAndroid", Collections.singleton(Bridge.ORIGIN), bridge);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("window.__mhBack ? window.__mhBack() : false", v -> {
                    if (!"true".equals(v)) moveTaskToBack(true);
                });
            }
        });

        // A tapped bill reminder opens Debts & bills.
        String route = getIntent().getStringExtra("route");
        web.loadUrl(route != null && route.matches("/[a-z]+") ? START + "#" + route : START);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = intent.getStringExtra("route");
        if (route != null && route.matches("/[a-z]+") && web != null) web.evaluateJavascript("location.hash='" + route + "'", null);
    }

    /** Blocks screenshots and screen recording while on (Settings > Security > Allow screenshots off). */
    void setSecure(boolean on) {
        runOnUiThread(() -> {
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        });
    }

    /** Android 13 and later ask once before an app may show notifications. */
    void askNotifications(Granted done) {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                pendingGranted = done;
                notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS);
            } else {
                done.done(Reminders.allowed(this));
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        bridge.emit("resume");
    }

    @Override
    protected void onPause() {
        bridge.emit("pause");
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void onFilePicked(ActivityResult r) {
        if (fileCallback == null) return;
        Uri u = r.getResultCode() == Activity.RESULT_OK && r.getData() != null ? r.getData().getData() : null;
        fileCallback.onReceiveValue(u == null ? null : new Uri[]{u});
        fileCallback = null;
    }

    /** Asks where to save, then writes the file there (export, backup, recovery key). */
    void saveFile(String name, String mime, String data, boolean base64, Saved done) {
        runOnUiThread(() -> {
            pendingSave = base64 ? Base64.getDecoder().decode(data) : data.getBytes(StandardCharsets.UTF_8);
            pendingSaved = done;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
            createFile.launch(i);
        });
    }

    private void onFileCreated(ActivityResult r) {
        Saved done = pendingSaved;
        byte[] bytes = pendingSave;
        pendingSaved = null;
        pendingSave = null;
        if (done == null) return;
        Uri u = r.getResultCode() == Activity.RESULT_OK && r.getData() != null ? r.getData().getData() : null;
        if (u == null || bytes == null) {
            done.done(false);
            return;
        }
        try (OutputStream out = getContentResolver().openOutputStream(u)) {
            if (out == null) throw new IllegalStateException("no stream");
            out.write(bytes);
            done.done(true);
        } catch (Exception e) {
            done.done(false);
        }
    }
}
