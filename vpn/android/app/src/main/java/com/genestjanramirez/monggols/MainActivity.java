package com.genestjanramirez.monggols;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.net.VpnService;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.wireguard.android.backend.Backend;
import com.wireguard.android.backend.GoBackend;
import com.wireguard.android.backend.Tunnel;
import com.wireguard.config.Config;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    // Invite links come from the wg-easy admin page ("one-time link"):
    // https://<server>/cnf/<code>. A bare code is accepted too.
    private static final String SERVER = "https://vpn.genestjanramirez.com";
    private static final Pattern LINK = Pattern.compile("https?://\\S+/cnf/[A-Za-z0-9_-]+");

    private static final int REQUEST_VPN = 1;
    private static final int REQUEST_FILE = 2;
    private static final String PREFS = "monggols";
    private static final String KEY_CONFIG = "config";

    // One backend and one tunnel for the whole process, so the connection
    // survives the screen being closed and reopened.
    private static Backend backend;
    private static final AppTunnel tunnel = new AppTunnel();

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private View[] pages;
    private ViewGroup[] navItems;
    private ImageView powerRing;
    private TextView connectLabel, statusIcon, statusTitle, statusBody, protectStatus;
    private View setupPanel, readyPanel;
    private EditText inviteField;
    private boolean busy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        if (backend == null) backend = new GoBackend(getApplicationContext());

        pages = new View[]{
                findViewById(R.id.pageHome), findViewById(R.id.pageServer),
                findViewById(R.id.pageProtect), findViewById(R.id.pageSettings)};
        navItems = new ViewGroup[]{
                findViewById(R.id.navHome), findViewById(R.id.navServer),
                findViewById(R.id.navProtect), findViewById(R.id.navSettings)};
        for (int i = 0; i < navItems.length; i++) {
            int page = i;
            navItems[i].setOnClickListener(v -> showPage(page));
        }

        powerRing = findViewById(R.id.powerRing);
        connectLabel = findViewById(R.id.connectLabel);
        statusIcon = findViewById(R.id.statusIcon);
        statusTitle = findViewById(R.id.statusTitle);
        statusBody = findViewById(R.id.statusBody);
        protectStatus = findViewById(R.id.protectStatus);
        setupPanel = findViewById(R.id.setupPanel);
        readyPanel = findViewById(R.id.readyPanel);
        inviteField = findViewById(R.id.inviteField);

        findViewById(R.id.connectButton).setOnClickListener(v -> toggle());
        findViewById(R.id.bannerButton).setOnClickListener(v -> {
            if (currentState() != Tunnel.State.UP) toggle();
        });
        findViewById(R.id.menuButton).setOnClickListener(v -> showPage(3));
        findViewById(R.id.destinationCard).setOnClickListener(v -> showPage(1));
        findViewById(R.id.setupButton).setOnClickListener(v -> setUpFromLink(inviteField.getText().toString()));
        findViewById(R.id.fileLink).setOnClickListener(v -> pickFile());
        findViewById(R.id.resetLink).setOnClickListener(v -> confirmReset());

        // Display-only for now: the VPN itself already does the protecting.
        Switch manyak = findViewById(R.id.manyakSwitch);
        manyak.setOnCheckedChangeListener((b, on) -> {
            if (on) toast(getString(R.string.coming_soon));
        });

        tunnel.listener = state -> main.post(this::render);
        showPage(savedConfig() == null ? 3 : 0);
        handleShare(getIntent());
        render();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        render();
    }

    @Override
    protected void onDestroy() {
        tunnel.listener = null;
        worker.shutdown();
        super.onDestroy();
    }

    // ---- Screen ----

    private void showPage(int index) {
        for (int i = 0; i < pages.length; i++) {
            pages[i].setVisibility(i == index ? View.VISIBLE : View.GONE);
            int color = getColor(i == index ? R.color.red : R.color.muted);
            for (int c = 0; c < navItems[i].getChildCount(); c++) {
                ((TextView) navItems[i].getChildAt(c)).setTextColor(color);
            }
        }
    }

    private void render() {
        boolean hasSetup = savedConfig() != null;
        setupPanel.setVisibility(hasSetup ? View.GONE : View.VISIBLE);
        readyPanel.setVisibility(hasSetup ? View.VISIBLE : View.GONE);

        boolean up = currentState() == Tunnel.State.UP;
        int accent = getColor(up ? R.color.green : R.color.red);
        powerRing.setImageResource(up ? R.drawable.power_green : R.drawable.power_red);
        connectLabel.setText(busy ? R.string.state_busy : up ? R.string.disconnect : R.string.connect);
        statusIcon.setTextColor(accent);
        statusTitle.setTextColor(accent);
        statusTitle.setText(busy ? R.string.state_busy : up ? R.string.state_on : R.string.state_off);
        statusBody.setText(up ? R.string.state_on_body : R.string.state_off_body);
        protectStatus.setText(up ? R.string.state_on : R.string.state_off);
        protectStatus.setTextColor(accent);
    }

    private Tunnel.State currentState() {
        try {
            return backend.getState(tunnel);
        } catch (Exception e) {
            return Tunnel.State.DOWN;
        }
    }

    // ---- Connecting ----

    private void toggle() {
        if (busy) return;
        if (savedConfig() == null) {
            toast(getString(R.string.need_setup));
            showPage(3);
            return;
        }
        if (currentState() == Tunnel.State.UP) {
            setState(Tunnel.State.DOWN);
            return;
        }
        Intent permission = VpnService.prepare(this);
        if (permission != null) {
            startActivityForResult(permission, REQUEST_VPN);
        } else {
            setState(Tunnel.State.UP);
        }
    }

    private void setState(Tunnel.State target) {
        String text = savedConfig();
        if (text == null) return;
        busy = true;
        render();
        worker.execute(() -> {
            String error = null;
            try {
                Config config = target == Tunnel.State.UP ? parse(text) : null;
                backend.setState(tunnel, target, config);
            } catch (Exception e) {
                error = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            }
            String shown = error;
            main.post(() -> {
                busy = false;
                render();
                if (shown != null) toast(getString(R.string.err_connect, shown));
            });
        });
    }

    // ---- Setting up ----

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (shared == null) return;
        Matcher m = LINK.matcher(shared);
        String link = m.find() ? m.group() : shared.trim();
        showPage(3);
        inviteField.setText(link);
        if (savedConfig() == null) setUpFromLink(link);
    }

    private void setUpFromLink(String input) {
        String link = input.trim();
        if (link.isEmpty() || busy) return;
        if (!link.startsWith("http")) link = SERVER + "/cnf/" + link;
        String url = link;
        busy = true;
        worker.execute(() -> {
            String text = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(15000);
                if (c.getResponseCode() == 200) {
                    try (InputStream in = c.getInputStream()) {
                        text = read(in);
                    }
                    parse(text);
                }
                c.disconnect();
            } catch (Exception e) {
                text = null;
            }
            String result = text;
            main.post(() -> {
                busy = false;
                if (result == null) {
                    toast(getString(R.string.err_link));
                } else {
                    save(result);
                    inviteField.setText("");
                    toast(getString(R.string.setup_done));
                    showPage(0);
                }
                render();
            });
        });
    }

    private void pickFile() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(i, REQUEST_FILE);
    }

    private void setUpFromFile(Uri uri) {
        worker.execute(() -> {
            String text;
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                text = read(in);
                parse(text);
            } catch (Exception e) {
                text = null;
            }
            String result = text;
            main.post(() -> {
                if (result == null) {
                    toast(getString(R.string.err_file));
                } else {
                    save(result);
                    toast(getString(R.string.setup_done));
                    showPage(0);
                }
                render();
            });
        });
    }

    private void confirmReset() {
        new AlertDialog.Builder(this)
                .setMessage(R.string.reset_confirm)
                .setPositiveButton(R.string.yes, (d, w) -> {
                    if (currentState() == Tunnel.State.UP) setState(Tunnel.State.DOWN);
                    prefs().edit().remove(KEY_CONFIG).apply();
                    render();
                })
                .setNegativeButton(R.string.no, null)
                .show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_VPN) {
            if (resultCode == RESULT_OK) setState(Tunnel.State.UP);
            else toast(getString(R.string.err_permission));
        } else if (requestCode == REQUEST_FILE && resultCode == RESULT_OK && data != null && data.getData() != null) {
            setUpFromFile(data.getData());
        }
    }

    // ---- Helpers ----

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String savedConfig() {
        return prefs().getString(KEY_CONFIG, null);
    }

    private void save(String config) {
        prefs().edit().putString(KEY_CONFIG, config).apply();
    }

    private static Config parse(String text) throws Exception {
        return Config.parse(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    static final class AppTunnel implements Tunnel {
        interface Listener {
            void onChange(State state);
        }

        volatile Listener listener;

        @Override
        public String getName() {
            // Android tunnel names: 15 characters at most, no spaces.
            return "Monggols-UK";
        }

        @Override
        public void onStateChange(State newState) {
            Listener l = listener;
            if (l != null) l.onChange(newState);
        }
    }
}
