package com.genestjanramirez.money;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/** An alarm from Reminders went off: show that bill's reminder. Not reachable by other apps. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Reminders.ACTION.equals(intent.getAction())) return;
        Uri data = intent.getData();
        String id = data == null ? "reminder" : String.valueOf(data.getLastPathSegment());
        Reminders.show(context, id, intent.getStringExtra("title"), intent.getStringExtra("body"));
    }
}
