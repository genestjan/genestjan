package com.genestjanramirez.gendrive.core.trip

import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** One speed reading during a trip, for scoring how the car was driven. */
data class DriveSample(val timestampMs: Long, val speedKmh: Double)

/**
 * Overdrive's "Driving DNA": a 0-100 read on how smoothly and efficiently a trip
 * was driven, from the speed trace plus the trip's energy use. Sub-scores are
 * kept so the driver sees *why*, not just a number.
 */
data class DrivingScore(
    val overall: Int,
    val smoothness: Int,
    val anticipation: Int,
    val efficiency: Int?,
) {
    val grade: String get() = when (overall) {
        in 90..100 -> "Excellent"
        in 75..89 -> "Smooth"
        in 60..74 -> "Good"
        in 40..59 -> "Fair"
        else -> "Jerky"
    }
}

object DrivingDna {
    /** Above this deceleration (m/s²) counts as a hard brake: ~0.3 g. */
    private const val HARD_BRAKE_MS2 = 3.0

    /** A gap longer than this between samples is a pause in logging, not real motion. */
    private const val MAX_GAP_MS = 5_000L

    /**
     * [baselineKwhPer100] is "ordinary" consumption for the car; using less than
     * that scores full efficiency. Pass the trip's consumption, or null if unknown
     * (then efficiency is left out and the overall is smoothness and anticipation only).
     */
    fun score(
        samples: List<DriveSample>,
        consumptionKwhPer100: Double?,
        baselineKwhPer100: Double = 15.0,
    ): DrivingScore {
        var sumSqAccel = 0.0
        var steps = 0
        var hardBrakes = 0
        for (i in 1 until samples.size) {
            val dtMs = samples[i].timestampMs - samples[i - 1].timestampMs
            if (dtMs <= 0 || dtMs > MAX_GAP_MS) continue
            val dtS = dtMs / 1000.0
            // km/h to m/s is /3.6; acceleration in m/s².
            val accel = ((samples[i].speedKmh - samples[i - 1].speedKmh) / 3.6) / dtS
            sumSqAccel += accel * accel
            steps++
            if (accel <= -HARD_BRAKE_MS2) hardBrakes++
        }

        val smoothness = if (steps == 0) 100 else {
            val rms = sqrt(sumSqAccel / steps) // typical gentle driving sits near 0.3-0.6 m/s²
            clamp((100.0 - 25.0 * rms).roundToInt())
        }
        // Hard brakes per minute of logged motion, so a long calm drive is not punished for one stop.
        val minutes = (samples.lastOrNull()?.timestampMs?.minus(samples.firstOrNull()?.timestampMs ?: 0L) ?: 0L) / 60_000.0
        val brakeRate = if (minutes < 0.1) hardBrakes.toDouble() else hardBrakes / minutes
        val anticipation = clamp((100.0 - 18.0 * brakeRate).roundToInt())

        val efficiency = consumptionKwhPer100
            ?.takeIf { it > 0 && baselineKwhPer100 > 0 }
            ?.let { clamp((100.0 * baselineKwhPer100 / it).roundToInt()) }

        val overall = if (efficiency == null) {
            (0.6 * smoothness + 0.4 * anticipation).roundToInt()
        } else {
            (0.4 * smoothness + 0.3 * anticipation + 0.3 * efficiency).roundToInt()
        }
        return DrivingScore(clamp(overall), smoothness, anticipation, efficiency)
    }

    private fun clamp(v: Int): Int = v.coerceIn(0, 100)
}
