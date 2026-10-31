package com.genestjanramirez.money;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bill reminders. The unlocked app hands over the list (what, when); this schedules one alarm
 * each, keeps the list so alarms come back after a restart, and shows the notification when an
 * alarm goes off. On the lock screen it only says that a bill is due soon.
 */
final class Reminders {
    static final String ACTION = "com.genestjanramirez.money.REMIND";
    private static final String CHANNEL = "bills";

    private Reminders() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("reminders", Context.MODE_PRIVATE);
    }

    /** Replaces every scheduled reminder with this list. Returns how many are in the future. */
    static synchronized int schedule(Context c, JSONArray items) throws Exception {
        cancelAll(c);
        prefs(c).edit().putString("items", items.toString()).apply();
        return arm(c, items);
    }

    /** After a restart or an app update, alarms are gone: set them again from the saved list. */
    static synchronized void restore(Context c) {
        try {
            arm(c, new JSONArray(prefs(c).getString("items", "[]")));
        } catch (Exception ignored) {
            // nothing saved
        }
    }

    static int count(Context c) {
        try {
            JSONArray items = new JSONArray(prefs(c).getString("items", "[]"));
            int n = 0;
            for (int i = 0; i < items.length(); i++) if (items.getJSONObject(i).optLong("at") > System.currentTimeMillis()) n++;
            return n;
        } catch (Exception e) {
            return 0;
        }
    }

    private static int arm(Context c, JSONArray items) throws Exception {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        int n = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.getJSONObject(i);
            long at = o.optLong("at");
            if (at <= now) continue;
            // Inexact on purpose: no special alarm permission needed, and still delivered while
            // the phone is idle (Doze), usually within minutes of the time.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm(c, o.getString("id"), o.optString("title"), o.optString("body"), PendingIntent.FLAG_UPDATE_CURRENT));
            n++;
        }
        return n;
    }

    private static void cancelAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray old = new JSONArray(prefs(c).getString("items", "[]"));
            for (int i = 0; i < old.length(); i++) {
                PendingIntent pi = alarm(c, old.getJSONObject(i).getString("id"), null, null, PendingIntent.FLAG_NO_CREATE);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        } catch (Exception ignored) {
            // nothing to cancel
        }
    }

    private static PendingIntent alarm(Context c, String id, String title, String body, int flag) {
        Intent i = new Intent(c, ReminderReceiver.class)
                .setAction(ACTION)
                .setData(Uri.parse("moneyhub://remind/" + Uri.encode(id)));
        if (title != null) i.putExtra("title", title).putExtra("body", body);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, flag | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean allowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    static void show(Context c, String id, String title, String body) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || !allowed(c)) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Bill reminders", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("A reminder some days before each bill is due");
        nm.createNotificationChannel(ch);

        Intent open = new Intent(c, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("route", "/debts");
        PendingIntent tap = PendingIntent.getActivity(c, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification hidden = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_money)
                .setContentTitle("Money Hub")
                .setContentText("A bill is due soon")
                .build();
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_money)
                .setColor(0xFFFFB03A)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(hidden)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build();
        nm.notify(id.hashCode(), n);
    }
}
