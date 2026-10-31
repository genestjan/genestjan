package com.genestjanramirez.gendrive.ui

import android.content.Context
import com.genestjanramirez.gendrive.core.vehicle.DistanceUnit
import com.genestjanramirez.gendrive.core.vehicle.Units
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Number and date formatting for the UI. A dash means "the car did not report this". */
object Fmt {
    const val DASH = "-"

    fun int(v: Double?): String = v?.roundToInt()?.toString() ?: DASH

    fun one(v: Double?): String = v?.let { String.format(Locale.US, "%.1f", it) } ?: DASH

    fun money(v: Double, currency: String): String =
        currency + NumberFormat.getIntegerInstance(Locale.US).format(v.roundToLong())

    fun distance(km: Double?, unit: DistanceUnit): String {
        if (km == null) return DASH
        val v = Units.distance(km, unit)
        val n = if (v < 100) String.format(Locale.US, "%.1f", v) else NumberFormat.getIntegerInstance(Locale.US).format(v.roundToLong())
        return "$n ${unit.label}"
    }

    fun speed(kmh: Double?, unit: DistanceUnit): String = kmh?.let { Units.speedIn(it, unit).roundToInt().toString() } ?: DASH

    fun speedUnit(unit: DistanceUnit): String = if (unit == DistanceUnit.MI) "mph" else "km/h"

    fun duration(ms: Long): String {
        val minutes = (ms / 60_000).coerceAtLeast(0)
        val h = minutes / 60
        val m = minutes % 60
        return if (h > 0) "$h h $m min" else "$m min"
    }

    fun clock(ms: Long): String {
        val total = (ms / 1000).coerceAtLeast(0)
        return String.format(Locale.US, "%d:%02d", total / 60, total % 60)
    }

    fun time(context: Context, ms: Long): String = android.text.format.DateFormat.getTimeFormat(context).format(Date(ms))

    fun dayAndTime(context: Context, ms: Long): String =
        SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date(ms)) + " · " + time(context, ms)
}
