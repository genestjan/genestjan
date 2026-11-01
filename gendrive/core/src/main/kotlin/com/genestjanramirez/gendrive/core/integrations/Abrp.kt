package com.genestjanramirez.gendrive.core.integrations

import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * A Better Routeplanner (ABRP) live telemetry. GenDrive pushes the car's state
 * of charge, speed and power to ABRP's generic telemetry API so its trip planner
 * routes around the real battery instead of a guess.
 *
 * This builds the `tlm` JSON and the send URL exactly to ABRP's spec; the Android
 * side does the HTTP POST on a timer while driving or charging. Pure and tested.
 *
 * The user pastes their own ABRP user token (Settings, Live Data in ABRP). The
 * api_key identifies the GenDrive integration to ABRP.
 */
object Abrp {
    const val ENDPOINT = "https://api.iternio.com/1/tlm/send"

    /**
     * ABRP telemetry object. Only fields the car actually reports are included,
     * because ABRP treats a missing field as "unknown" but a wrong field as truth.
     * `utc` is required by ABRP; everything else is best-effort.
     */
    fun telemetry(state: VehicleState, utcSeconds: Long): JsonObject = buildJsonObject {
        put("utc", utcSeconds)
        state.socPercent?.let { put("soc", round(it, 1)) }
        state.speedKmh?.let { put("speed", round(it, 1)) }
        state.rangeKm?.let { put("est_battery_range", it) }
        state.batteryTempC?.let { put("batt_temp", round(it, 1)) }
        state.outsideTempC?.let { put("ext_temp", round(it, 1)) }
        state.odometerKm?.let { put("odometer", round(it, 1)) }
        put("is_charging", if (state.isCharging) 1 else 0)
        put("is_parked", if (state.gear == com.genestjanramirez.gendrive.core.vehicle.Gear.P) 1 else 0)
        // ABRP power is battery kW: negative while charging, positive while driving.
        // We only know charge power for certain, so we report it when charging and
        // leave power unset while driving rather than invent a draw figure.
        if (state.isCharging) {
            state.chargePowerKw?.let { put("power", round(-it, 2)) }
        }
    }

    /**
     * The full GET URL ABRP accepts: token is the user's, apiKey is GenDrive's
     * registered key. The telemetry JSON is URL-encoded into the `tlm` parameter.
     */
    fun sendUrl(apiKey: String, userToken: String, telemetry: JsonObject): String {
        val tlm = Http.percentEncode(telemetry.toString())
        return "$ENDPOINT?api_key=${Http.percentEncode(apiKey)}&token=${Http.percentEncode(userToken)}&tlm=$tlm"
    }

    private fun round(v: Double, dp: Int): Double {
        var f = 1.0
        repeat(dp) { f *= 10 }
        return kotlin.math.round(v * f) / f
    }
}
