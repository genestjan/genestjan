package com.genestjanramirez.gendrive.system

import android.Manifest
import android.app.AppOpsManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** One item on the Setup checklist. */
enum class Access(val title: String, val why: String) {
    NOTIFICATIONS("See what's playing and the next turn", "Music controls, lyrics and Google Maps turn cards."),
    MICROPHONE("Microphone for the voice assistant", "So you can talk to the assistant."),
    USAGE("See which app is on screen", "Needed by the video guard to spot video apps."),
    OVERLAY("Draw over other apps", "Lets the video guard cover the picture while moving."),
    INSTALL("Install apps", "Lets the App Hub install APK files for you."),
}

object Permissions {

    fun granted(context: Context, access: Access): Boolean = when (access) {
        Access.NOTIFICATIONS -> NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
        Access.MICROPHONE -> ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        Access.USAGE -> hasUsageAccess(context)
        Access.OVERLAY -> Settings.canDrawOverlays(context)
        Access.INSTALL -> context.packageManager.canRequestPackageInstalls()
    }

    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(AppOpsManager::class.java) ?: return false
        @Suppress("DEPRECATION")
        val mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /** The system screen for a permission. Returns false when BYD has removed that screen. */
    fun openSettings(context: Context, access: Access): Boolean {
        val pkg = Uri.parse("package:${context.packageName}")
        val intent = when (access) {
            Access.NOTIFICATIONS -> Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            Access.MICROPHONE -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
            Access.USAGE -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            Access.OVERLAY -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg)
            Access.INSTALL -> Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, pkg)
        }
        return start(context, intent)
    }

    fun openHomeSettings(context: Context): Boolean = start(context, Intent(Settings.ACTION_HOME_SETTINGS))

    /** BYD's own "app start management" screen, where an app can be allowed to start with the car. */
    private const val BYD_AUTOSTART = "com.byd.appstartmanagement"

    fun hasBydAutostart(context: Context): Boolean = context.packageManager.getLaunchIntentForPackage(BYD_AUTOSTART) != null

    fun openBydAutostart(context: Context): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(BYD_AUTOSTART) ?: return false
        return start(context, intent)
    }

    private fun start(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }

    private fun homeAlias(context: Context) = ComponentName(context.packageName, "com.genestjanramirez.gendrive.HomeAlias")

    fun isHomeEnabled(context: Context): Boolean =
        context.packageManager.getComponentEnabledSetting(homeAlias(context)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED

    /** Offers GenDrive as a home screen. Reversible: switch it off and BYD's launcher is back. */
    fun setHomeEnabled(context: Context, enabled: Boolean) {
        context.packageManager.setComponentEnabledSetting(
            homeAlias(context),
            if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP,
        )
    }
}
