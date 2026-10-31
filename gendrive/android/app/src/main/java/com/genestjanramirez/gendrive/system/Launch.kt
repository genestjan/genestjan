package com.genestjanramirez.gendrive.system

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent

/**
 * Opens an installed app by package name. The one place that launches apps, so every
 * caller gets the same handling when an app is missing or its launcher is disabled.
 * [adjacent] opens it beside GenDrive when the screen is split.
 */
fun launchPackage(context: Context, pkg: String, adjacent: Boolean = false): Boolean {
    val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return false
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (adjacent) intent.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
    return try {
        context.startActivity(intent)
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }
}
