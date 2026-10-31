package com.genestjanramirez.gendrive.core.trip

import com.genestjanramirez.gendrive.core.drive.DriveStateMachine
import com.genestjanramirez.gendrive.core.drive.Motion
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlinx.serialization.Serializable
import kotlin.math.max

@Serializable
data class Trip(
    val id: String,
    val startMs: Long,
    val endMs: Long,
    val distanceKm: Double,
    val startSoc: Double? = null,
    val endSoc: Double? = null,
    val energyKwh: Double? = null,
    val maxSpeedKmh: Double = 0.0,
    val avgSpeedKmh: Double = 0.0,
    val startOdometerKm: Double? = null,
    val endOdometerKm: Double? = null,
    /** Recorded from the built-in demo drive, not a real car. */
    val demo: Boolean = false,
) {
    val durationMs: Long get() = endMs - startMs

    fun consumptionKwhPer100(): Double? = energyKwh?.let { EnergyMath.per100(it, distanceKm) }
}

@Serializable
data class ChargeSession(
    val id: String,
    val startMs: Long,
    val endMs: Long,
    val startSoc: Double? = null,
    val endSoc: Double? = null,
    val energyKwh: Double,
    val maxPowerKw: Double,
) {
    /** Above 22 kW is DC fast charging; home and AC public chargers stay below it. */
    val isDcFast: Boolean get() = maxPowerKw > 22.0
}

object EnergyMath {
    fun energyFromSoc(startSoc: Double?, endSoc: Double?, capacityKwh: Double): Double? {
        if (startSoc == null || endSoc == null || capacityKwh <= 0.0) return null
        return (startSoc - endSoc) / 100.0 * capacityKwh
    }

    fun per100(energyKwh: Double, distanceKm: Double): Double? =
        if (distanceKm < 0.1) null else energyKwh / distanceKm * 100.0

    /** Cost of energy that reached the battery, adding back what was lost while charging. */
    fun electricityCost(energyKwh: Double, pricePerKwh: Double, chargingLossPct: Double): Double {
        val loss = chargingLossPct.coerceIn(0.0, 50.0) / 100.0
        return energyKwh.coerceAtLeast(0.0) * pricePerKwh / (1.0 - loss)
    }

    fun petrolCost(distanceKm: Double, litresPer100Km: Double, pricePerLitre: Double): Double =
        distanceKm.coerceAtLeast(0.0) * litresPer100Km / 100.0 * pricePerLitre
}

data class CostSettings(
    val currency: String = "₱",
    val pricePerKwh: Double = 12.0,
    val chargingLossPct: Double = 10.0,
    val petrolPricePerLitre: Double = 60.0,
    val petrolLitresPer100Km: Double = 8.0,
    val batteryCapacityKwh: Double = 55.4,
)

data class CostSummary(
    val trips: Int,
    val distanceKm: Double,
    val energyKwh: Double,
    val electricityCost: Double,
    val petrolCost: Double,
) {
    val saved: Double get() = petrolCost - electricityCost
    val consumptionKwhPer100: Double? get() = EnergyMath.per100(energyKwh, distanceKm)
}

object TripStats {
    fun summarise(trips: List<Trip>, settings: CostSettings): CostSummary {
        val distance = trips.sumOf { it.distanceKm }
        val energy = trips.sumOf { (it.energyKwh ?: 0.0).coerceAtLeast(0.0) }
        return CostSummary(
            trips = trips.size,
            distanceKm = distance,
            energyKwh = energy,
            electricityCost = EnergyMath.electricityCost(energy, settings.pricePerKwh, settings.chargingLossPct),
            petrolCost = EnergyMath.petrolCost(distance, settings.petrolLitresPer100Km, settings.petrolPricePerLitre),
        )
    }

    fun since(trips: List<Trip>, fromMs: Long): List<Trip> = trips.filter { it.startMs >= fromMs }

    /**
     * Energy per km this week against last week, as a percentage change.
     * Negative means this week was more efficient. Null until both weeks have
     * at least 20 km with energy data, so one short trip cannot swing it.
     */
    fun weekOverWeekChangePct(trips: List<Trip>, nowMs: Long): Double? {
        val week = 7L * 24 * 3_600_000
        fun per100(list: List<Trip>): Double? {
            val withEnergy = list.filter { it.energyKwh != null && it.energyKwh > 0.0 }
            val km = withEnergy.sumOf { it.distanceKm }
            if (km < 20.0) return null
            return withEnergy.sumOf { it.energyKwh ?: 0.0 } / km * 100.0
        }
        val thisWeek = per100(trips.filter { it.startMs >= nowMs - week }) ?: return null
        val lastWeek = per100(trips.filter { it.startMs >= nowMs - 2 * week && it.startMs < nowMs - week }) ?: return null
        return (thisWeek - lastWeek) / lastWeek * 100.0
    }
}

/**
 * Turns a stream of car snapshots into trips. A trip starts when the car starts
 * moving and ends after it has sat in Park (or stopped sending data) for a while,
 * so a quick stop at a shop with the car left on stays one trip.
 */
class TripRecorder(
    private val capacityKwh: () -> Double,
    private val endAfterParkedMs: Long = 120_000L,
    private val maxGapMs: Long = 300_000L,
    private val minDistanceKm: Double = 0.3,
) {
    private class Active(
        val startMs: Long,
        val startSoc: Double?,
        val startOdo: Double?,
        val demo: Boolean,
        var lastMs: Long,
        var lastSoc: Double?,
        var lastOdo: Double?,
        var integratedKm: Double = 0.0,
        var maxSpeed: Double = 0.0,
        var parkedSinceMs: Long? = null,
    )

    private val drive = DriveStateMachine()
    private var active: Active? = null

    val isRecording: Boolean get() = active != null

    /** Distance so far in the trip being recorded, for the live dashboard. */
    val liveDistanceKm: Double get() = active?.let { bestDistance(it) } ?: 0.0

    /** Feed every snapshot. Returns a trip when one has just finished. */
    fun onSample(s: VehicleState): Trip? {
        val now = s.timestampMs
        val current = active
        if (current != null && now - current.lastMs > maxGapMs) {
            // The car slept or the app was killed: close the old trip at its last sample.
            val done = finish(current, current.lastMs)
            active = null
            onSample(s)
            return done
        }
        val motion = drive.update(s)
        if (current == null) {
            if (motion == Motion.MOVING) {
                active = Active(
                    startMs = now,
                    startSoc = s.socPercent,
                    startOdo = s.odometerKm,
                    demo = s.source == DataSource.DEMO,
                    lastMs = now,
                    lastSoc = s.socPercent,
                    lastOdo = s.odometerKm,
                )
            }
            return null
        }
        val dtMs = (now - current.lastMs).coerceIn(0L, 5_000L)
        val speed = s.speedKmh ?: 0.0
        current.integratedKm += speed * dtMs / 3_600_000.0
        current.maxSpeed = max(current.maxSpeed, speed)
        current.lastMs = now
        s.socPercent?.let { current.lastSoc = it }
        s.odometerKm?.let { current.lastOdo = it }

        val parked = s.gear == Gear.P || motion == Motion.PARKED
        if (parked) {
            val since = current.parkedSinceMs ?: now.also { current.parkedSinceMs = it }
            if (now - since >= endAfterParkedMs) {
                active = null
                return finish(current, since)
            }
        } else {
            current.parkedSinceMs = null
        }
        return null
    }

    /** Close the trip in progress, for example when the service stops. */
    fun flush(): Trip? {
        val current = active ?: return null
        active = null
        return finish(current, current.parkedSinceMs ?: current.lastMs)
    }

    private fun bestDistance(a: Active): Double {
        val start = a.startOdo
        val last = a.lastOdo
        val odoDelta = if (start != null && last != null) last - start else null
        // The odometer counts whole kilometres on some trims, so only trust it once it moved
        // and agrees roughly with the speed-based estimate.
        return if (odoDelta != null && odoDelta >= 1.0 && odoDelta <= a.integratedKm * 2 + 2) odoDelta else a.integratedKm
    }

    private fun finish(a: Active, endMs: Long): Trip? {
        val distance = bestDistance(a)
        if (distance < minDistanceKm) return null
        val durationH = (endMs - a.startMs).coerceAtLeast(1L) / 3_600_000.0
        return Trip(
            id = "trip-${a.startMs}",
            startMs = a.startMs,
            endMs = endMs,
            distanceKm = distance,
            startSoc = a.startSoc,
            endSoc = a.lastSoc,
            energyKwh = EnergyMath.energyFromSoc(a.startSoc, a.lastSoc, capacityKwh()),
            maxSpeedKmh = a.maxSpeed,
            avgSpeedKmh = distance / durationH,
            startOdometerKm = a.startOdo,
            endOdometerKm = a.lastOdo,
            demo = a.demo,
        )
    }
}

/**
 * Turns snapshots into charging sessions. Energy is measured by adding up the
 * charging power over time, with the battery percentage as a fallback.
 */
class ChargeRecorder(
    private val capacityKwh: () -> Double,
    private val startAfterMs: Long = 30_000L,
    private val endAfterMs: Long = 120_000L,
) {
    private class Active(
        val startMs: Long,
        val startSoc: Double?,
        var lastMs: Long,
        var lastSoc: Double?,
        var energyKwh: Double = 0.0,
        var maxPowerKw: Double = 0.0,
        var notChargingSinceMs: Long? = null,
    )

    private var chargingSinceMs: Long? = null
    private var firstSoc: Double? = null
    private var active: Active? = null

    val isCharging: Boolean get() = active != null

    fun onSample(s: VehicleState): ChargeSession? {
        val now = s.timestampMs
        val current = active
        if (current == null) {
            if (s.isCharging) {
                val since = chargingSinceMs ?: now.also {
                    chargingSinceMs = it
                    firstSoc = s.socPercent
                }
                if (now - since >= startAfterMs) {
                    active = Active(since, firstSoc ?: s.socPercent, now, s.socPercent, maxPowerKw = s.chargePowerKw ?: 0.0)
                }
            } else {
                chargingSinceMs = null
                firstSoc = null
            }
            return null
        }
        val dtMs = (now - current.lastMs).coerceIn(0L, 10_000L)
        val power = if (s.isCharging) s.chargePowerKw ?: 0.0 else 0.0
        current.energyKwh += power * dtMs / 3_600_000.0
        current.maxPowerKw = max(current.maxPowerKw, power)
        current.lastMs = now
        s.socPercent?.let { current.lastSoc = it }
        if (s.isCharging) {
            current.notChargingSinceMs = null
            return null
        }
        val since = current.notChargingSinceMs ?: now.also { current.notChargingSinceMs = it }
        if (now - since < endAfterMs) return null
        active = null
        chargingSinceMs = null
        return finish(current, since)
    }

    fun flush(): ChargeSession? {
        val current = active ?: return null
        active = null
        chargingSinceMs = null
        return finish(current, current.notChargingSinceMs ?: current.lastMs)
    }

    private fun finish(a: Active, endMs: Long): ChargeSession? {
        val socEnergy = EnergyMath.energyFromSoc(a.lastSoc, a.startSoc, capacityKwh())
        val energy = if (a.energyKwh >= 0.2) a.energyKwh else socEnergy ?: 0.0
        if (energy < 0.2) return null
        return ChargeSession(
            id = "charge-${a.startMs}",
            startMs = a.startMs,
            endMs = endMs,
            startSoc = a.startSoc,
            endSoc = a.lastSoc,
            energyKwh = energy,
            maxPowerKw = a.maxPowerKw,
        )
    }
}
