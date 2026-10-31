package com.genestjanramirez.gendrive.notify

import android.app.Notification
import android.graphics.Bitmap
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.graphics.drawable.toBitmap
import com.genestjanramirez.gendrive.core.maps.NavNotificationParser
import com.genestjanramirez.gendrive.graph

/**
 * With notification access, GenDrive can:
 *  - see which music app is playing (for controls and lyrics)
 *  - read Google Maps / Waze turn-by-turn notifications (for the next-turn card)
 * Nothing is stored or sent anywhere.
 */
class GenDriveNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        graph.media.refresh()
        try {
            activeNotifications?.forEach { handle(it) }
        } catch (e: Exception) {
            // Some head units throw here before the listener is fully bound.
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(sbn)
        if (sbn.notification.extras.containsKey(Notification.EXTRA_MEDIA_SESSION)) graph.media.refresh()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (sbn.packageName in NavNotificationParser.navigationPackages) graph.nav.clear(sbn.packageName)
    }

    private fun handle(sbn: StatusBarNotification) {
        if (sbn.packageName !in NavNotificationParser.navigationPackages) return
        val n = sbn.notification
        val isNavigation = sbn.isOngoing || n.category == Notification.CATEGORY_NAVIGATION
        if (!isNavigation) return
        val extras = n.extras
        val parsed = NavNotificationParser.parse(
            title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
            subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
            appPackage = sbn.packageName,
        ) ?: return
        graph.nav.update(parsed, arrowOf(n))
    }

    /** Google Maps puts the turn arrow in the notification's large icon. */
    private fun arrowOf(n: Notification): Bitmap? = try {
        n.getLargeIcon()?.loadDrawable(this)?.toBitmap(128, 128)
    } catch (e: Exception) {
        null
    }
}
