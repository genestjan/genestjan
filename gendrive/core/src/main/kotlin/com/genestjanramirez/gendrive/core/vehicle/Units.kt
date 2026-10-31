package com.genestjanramirez.gendrive.core.vehicle

import java.util.Locale
import kotlin.math.roundToInt

enum class PressureUnit(val label: String) { KPA("kPa"), BAR("bar"), PSI("psi") }

enum class DistanceUnit(val label: String) { KM("km"), MI("mi") }

/**
 * The BYD car API does not document units, and they differ between trims.
 * These helpers turn raw numbers into known units, or null when a value is
 * clearly not a real reading (sensors report 0 or 255 when asleep).
 */
object Units {
    private const val PSI_TO_KPA = 6.894757

    fun tyreToKpa(raw: Number?): Double? {
        val v = raw?.toDouble() ?: return null
        if (v.isNaN() || v <= 0.0) return null
        return when {
            v in 0.5..6.0 -> v * 100.0 // bar
            v in 15.0..60.0 -> v * PSI_TO_KPA // psi
            v in 100.0..600.0 -> v // kPa
            else -> null
        }
    }

    fun kpaTo(unit: PressureUnit, kpa: Double): Double = when (unit) {
        PressureUnit.KPA -> kpa
        PressureUnit.BAR -> kpa / 100.0
        PressureUnit.PSI -> kpa / PSI_TO_KPA
    }

    fun formatPressure(kpa: Double?, unit: PressureUnit): String {
        if (kpa == null) return "-"
        val v = kpaTo(unit, kpa)
        return when (unit) {
            PressureUnit.BAR -> String.format(Locale.US, "%.1f", v)
            else -> v.roundToInt().toString()
        }
    }

    /** 12 V battery: some trims report volts, others decivolts or millivolts. */
    fun auxVolts(raw: Number?): Double? {
        val v = raw?.toDouble() ?: return null
        return when {
            v in 5.0..20.0 -> v
            v in 50.0..200.0 -> v / 10.0
            v in 5_000.0..20_000.0 -> v / 1000.0
            else -> null
        }
    }

    fun soc(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it > 0.0 && it <= 100.0 }

    fun speed(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it >= 0.0 && it < 300.0 }

    fun temperature(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it > -50.0 && it < 90.0 }

    fun rangeKm(raw: Number?): Int? = raw?.toInt()?.takeIf { it in 1..2000 }

    fun odometer(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it > 0.0 && it < 2_000_000.0 }

    fun chargePower(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it >= 0.0 && it < 400.0 }

    fun consumption(raw: Number?): Double? = raw?.toDouble()?.takeIf { !it.isNaN() && it > 1.0 && it < 80.0 }

    fun distance(km: Double, unit: DistanceUnit): Double = if (unit == DistanceUnit.MI) km * 0.621371 else km

    fun speedIn(kmh: Double, unit: DistanceUnit): Double = distance(kmh, unit)
}
