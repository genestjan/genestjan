package com.genestjanramirez.money;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A restart or an app update clears alarms; put the bill reminders back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Reminders.restore(context);
        }
    }
}
