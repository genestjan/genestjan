package com.genestjanramirez.gendrive.nav

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import com.genestjanramirez.gendrive.core.maps.MapsLinks
import com.genestjanramirez.gendrive.core.maps.NavInstruction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class LiveNav(val instruction: NavInstruction, val arrow: Bitmap?, val updatedAt: Long)

/** The turn-by-turn step currently shown by Google Maps or Waze, if any. */
class NavRepository {
    private val _live = MutableStateFlow<LiveNav?>(null)
    val live: StateFlow<LiveNav?> = _live.asStateFlow()

    fun update(instruction: NavInstruction, arrow: Bitmap?) {
        _live.value = LiveNav(instruction, arrow ?: _live.value?.arrow, System.currentTimeMillis())
    }

    fun clear(appPackage: String) {
        if (_live.value?.instruction?.appPackage == appPackage) _live.value = null
    }
}

/**
 * Opens Google Maps (or Waze). Every Google Maps feature stays available because
 * it is Google's own app doing the navigating; GenDrive only starts it.
 */
object MapsLauncher {

    fun isInstalled(context: Context, pkg: String): Boolean =
        context.packageManager.getLaunchIntentForPackage(pkg) != null

    fun navigate(context: Context, destination: String, adjacent: Boolean = false): Boolean {
        if (destination.isBlank()) return openGoogleMaps(context, adjacent)
        val inApp = Intent(Intent.ACTION_VIEW, Uri.parse(MapsLinks.googleNavigate(destination)))
            .setPackage(MapsLinks.GOOGLE_MAPS_PACKAGE)
        return start(context, inApp, adjacent) ||
            start(context, Intent(Intent.ACTION_VIEW, Uri.parse(MapsLinks.googleDirectionsWeb(destination))), adjacent)
    }

    fun search(context: Context, query: String, adjacent: Boolean = false): Boolean {
        val inApp = Intent(Intent.ACTION_VIEW, Uri.parse(MapsLinks.googleSearch(query)))
            .setPackage(MapsLinks.GOOGLE_MAPS_PACKAGE)
        return start(context, inApp, adjacent) ||
            start(context, Intent(Intent.ACTION_VIEW, Uri.parse(MapsLinks.googleSearchWeb(query))), adjacent)
    }

    fun waze(context: Context, destination: String): Boolean =
        start(context, Intent(Intent.ACTION_VIEW, Uri.parse(MapsLinks.wazeNavigate(destination))), false)

    fun openGoogleMaps(context: Context, adjacent: Boolean = false): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(MapsLinks.GOOGLE_MAPS_PACKAGE) ?: return false
        return start(context, intent, adjacent)
    }

    fun openApp(context: Context, pkg: String, adjacent: Boolean = false): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return false
        return start(context, intent, adjacent)
    }

    private fun start(context: Context, intent: Intent, adjacent: Boolean): Boolean = try {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        // In split screen, open beside GenDrive instead of on top of it.
        if (adjacent) intent.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
        context.startActivity(intent)
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }
}
