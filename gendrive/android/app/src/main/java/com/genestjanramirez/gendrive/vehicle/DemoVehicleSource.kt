package com.genestjanramirez.gendrive.vehicle

import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.TyrePressures
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlin.math.sin

/**
 * A ten-minute loop: park, pull away, cruise, stop at a red light, drive on, park.
 * Lets GenDrive be tried on any phone or emulator, and shows every screen with data.
 */
internal class DemoVehicleSource(private val capacityKwh: () -> Double) {
    private val startMs = System.currentTimeMillis()
    private var lastMs = startMs
    private var soc = 78.0
    private var odometer = 12_480.0

    fun read(nowMs: Long): VehicleState {
        val t = ((nowMs - startMs) / 1000.0) % 600.0
        val speed = when {
            t < 40 -> 0.0
            t < 70 -> (t - 40) / 30 * 60
            t < 200 -> 60 + 8 * sin(t / 9)
            t < 220 -> 60 * (220 - t) / 20
            t < 250 -> 0.0
            t < 280 -> (t - 250) / 30 * 45
            t < 520 -> 45 + 6 * sin(t / 7)
            t < 545 -> 45 * (545 - t) / 25
            else -> 0.0
        }.coerceAtLeast(0.0)
        val gear = if (t < 30 || t >= 560) Gear.P else Gear.D
        val dtHours = (nowMs - lastMs).coerceIn(0L, 2_000L) / 3_600_000.0
        lastMs = nowMs
        val km = speed * dtHours
        odometer += km
        soc = (soc - km * 0.14 / capacityKwh() * 100).coerceAtLeast(5.0)
        return VehicleState(
            source = DataSource.DEMO,
            timestampMs = nowMs,
            speedKmh = speed,
            gear = gear,
            socPercent = soc,
            rangeKm = (soc / 100 * capacityKwh() / 0.145).toInt(),
            odometerKm = odometer,
            pluggedIn = false,
            chargePowerKw = 0.0,
            batteryTempC = 31.0,
            outsideTempC = 32.0,
            tyres = TyrePressures(248.0, 250.0, 244.0, 251.0),
            auxBatteryVolts = 13.1,
            consumptionKwhPer100Km = 14.2,
        )
    }
}
