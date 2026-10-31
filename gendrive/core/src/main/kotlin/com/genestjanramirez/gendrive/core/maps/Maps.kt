package com.genestjanramirez.gendrive.core.maps

import java.net.URLEncoder
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Links that open the real Google Maps (or Waze) app. GenDrive hands navigation
 * to Google's own app instead of embedding Google's map: Google's Maps Platform
 * terms do not allow embedding it in a car head unit outside the EEA, and the
 * real app is the only way to get every Google Maps feature anyway.
 */
object MapsLinks {
    const val GOOGLE_MAPS_PACKAGE = "com.google.android.apps.maps"
    const val WAZE_PACKAGE = "com.waze"

    fun enc(s: String): String = URLEncoder.encode(s.trim(), "UTF-8").replace("+", "%20")

    /** Starts turn-by-turn driving navigation straight away. */
    fun googleNavigate(destination: String): String = "google.navigation:q=${enc(destination)}&mode=d"

    fun googleNavigate(lat: Double, lng: Double): String =
        "google.navigation:q=${latLng(lat, lng)}&mode=d"

    /** Shows search results on the map, for example "EV charging". */
    fun googleSearch(query: String): String = "geo:0,0?q=${enc(query)}"

    /** Works in any browser if the Google Maps app is missing. */
    fun googleDirectionsWeb(destination: String): String =
        "https://www.google.com/maps/dir/?api=1&destination=${enc(destination)}&travelmode=driving&dir_action=navigate"

    fun googleSearchWeb(query: String): String = "https://www.google.com/maps/search/?api=1&query=${enc(query)}"

    fun wazeNavigate(destination: String): String = "https://waze.com/ul?q=${enc(destination)}&navigate=yes"

    private fun latLng(lat: Double, lng: Double) = String.format(Locale.US, "%.6f,%.6f", lat, lng)
}

/** Ready-made searches on the Maps screen. */
data class QuickSearch(val label: String, val query: String)

object QuickSearches {
    val all = listOf(
        QuickSearch("EV charging", "EV charging station"),
        QuickSearch("Food", "restaurants"),
        QuickSearch("Coffee", "coffee"),
        QuickSearch("Parking", "parking"),
        QuickSearch("Hospital", "hospital"),
        QuickSearch("BYD service", "BYD service centre"),
    )
}

data class NavInstruction(
    val distanceText: String?,
    val distanceMeters: Int?,
    val instruction: String,
    val eta: String?,
    val appPackage: String,
)

/**
 * Reads the turn-by-turn notification that Google Maps and Waze post while
 * navigating, so GenDrive can show the next turn on its own dashboard.
 * Typical Google Maps notification: title "250 m", text "Turn left onto EDSA",
 * sub text "12 min · 4.1 km · ETA 10:45".
 */
object NavNotificationParser {
    private val distance = Regex("""(\d+(?:[.,]\d+)?)\s?(km|m|mi|ft|yd)\b""", RegexOption.IGNORE_CASE)
    private val trimChars = charArrayOf(' ', '·', '-', ',', '•', '|')

    val navigationPackages = setOf(MapsLinks.GOOGLE_MAPS_PACKAGE, MapsLinks.WAZE_PACKAGE)

    fun parse(title: String?, text: String?, subText: String?, appPackage: String): NavInstruction? {
        val t = title?.trim().orEmpty()
        val x = text?.trim().orEmpty()
        if (t.isEmpty() && x.isEmpty()) return null
        val match = distance.find(t) ?: distance.find(x)
        val instruction = listOf(t, x)
            .map { part -> if (match != null && part.contains(match.value)) part.replace(match.value, "").trim(*trimChars) else part }
            .filter { it.isNotBlank() }
            .joinToString(" · ")
        return NavInstruction(
            distanceText = match?.value,
            distanceMeters = match?.let { toMeters(it.groupValues[1], it.groupValues[2]) },
            instruction = instruction.ifBlank { t.ifBlank { x } },
            eta = subText?.trim()?.takeIf { it.isNotEmpty() },
            appPackage = appPackage,
        )
    }

    fun toMeters(number: String, unit: String): Int? {
        val v = number.replace(',', '.').toDoubleOrNull() ?: return null
        val meters = when (unit.lowercase(Locale.US)) {
            "km" -> v * 1000.0
            "m" -> v
            "mi" -> v * 1609.344
            "ft" -> v * 0.3048
            "yd" -> v * 0.9144
            else -> return null
        }
        return meters.roundToInt()
    }
}
