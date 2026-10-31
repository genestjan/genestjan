package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.drive.DriveStateMachine
import com.genestjanramirez.gendrive.core.drive.Motion
import com.genestjanramirez.gendrive.core.drive.VideoApps
import com.genestjanramirez.gendrive.core.drive.VideoGuardPolicy
import com.genestjanramirez.gendrive.core.trip.ChargeRecorder
import com.genestjanramirez.gendrive.core.trip.CostSettings
import com.genestjanramirez.gendrive.core.trip.EnergyMath
import com.genestjanramirez.gendrive.core.trip.TripRecorder
import com.genestjanramirez.gendrive.core.trip.TripStats
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.Units
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DriveAndTripTest {

    private fun car(t: Long, speed: Double?, gear: Gear, soc: Double? = null, odo: Double? = null, power: Double? = null) =
        VehicleState(
            source = DataSource.BYD, timestampMs = t, speedKmh = speed, gear = gear,
            socPercent = soc, odometerKm = odo, chargePowerKw = power,
        )

    @Test
    fun driveStateHasHysteresis() {
        val m = DriveStateMachine()
        assertEquals(Motion.PARKED, m.update(3.0, Gear.D, 0))
        assertEquals(Motion.MOVING, m.update(6.0, Gear.D, 1_000))
        assertEquals(Motion.MOVING, m.update(0.0, Gear.D, 2_000)) // brief stop
        assertEquals(Motion.MOVING, m.update(0.0, Gear.D, 4_999))
        assertEquals(Motion.PARKED, m.update(0.0, Gear.D, 5_000)) // held still for 3 s
        assertEquals(Motion.MOVING, m.update(20.0, Gear.D, 6_000))
        assertEquals(Motion.PARKED, m.update(0.0, Gear.P, 7_000)) // P ends it at once
    }

    @Test
    fun videoPictureOnlyInPark() {
        assertTrue(VideoGuardPolicy.pictureAllowed(car(0, 0.0, Gear.P), 0))
        assertFalse(VideoGuardPolicy.pictureAllowed(car(0, 0.0, Gear.D), 60_000)) // red light is not Park
        assertFalse(VideoGuardPolicy.pictureAllowed(car(0, 0.0, Gear.N), 60_000))
        assertFalse(VideoGuardPolicy.pictureAllowed(car(0, 40.0, Gear.UNKNOWN), 0))
        assertFalse(VideoGuardPolicy.pictureAllowed(car(0, 0.0, Gear.UNKNOWN), 5_000))
        assertTrue(VideoGuardPolicy.pictureAllowed(car(0, 0.0, Gear.UNKNOWN), 10_000))
        assertTrue(VideoGuardPolicy.pictureAllowed(VehicleState.EMPTY, 0)) // no car data: hands off
        val demoDriving = car(0, 50.0, Gear.D).copy(source = DataSource.DEMO)
        assertTrue(VideoGuardPolicy.pictureAllowed(demoDriving, 0))
        assertFalse(VideoGuardPolicy.pictureAllowed(demoDriving, 0, includeDemoData = true))
        assertTrue(VideoApps.isVideoApp("com.netflix.mediaclient"))
        assertFalse(VideoApps.isVideoApp("com.spotify.music"))
    }

    @Test
    fun recordsATripFromOdometerAndSoc() {
        val rec = TripRecorder(capacityKwh = { 60.0 }, endAfterParkedMs = 60_000)
        var t = 0L
        assertNull(rec.onSample(car(t, 0.0, Gear.P, soc = 80.0, odo = 1000.0)))
        // Drive 10 minutes at 60 km/h = 10 km, odometer agrees.
        for (i in 1..600) {
            t += 1_000
            assertNull(rec.onSample(car(t, 60.0, Gear.D, soc = 80.0 - i * 0.003, odo = 1000.0 + i / 60.0)))
        }
        assertTrue(rec.isRecording)
        // Park for a minute.
        var done: com.genestjanramirez.gendrive.core.trip.Trip? = null
        for (i in 1..61) {
            t += 1_000
            done = rec.onSample(car(t, 0.0, Gear.P, soc = 78.2, odo = 1010.0)) ?: done
        }
        val trip = assertNotNull(done)
        assertEquals(10.0, trip.distanceKm, 0.05) // the trip starts at the first moving sample
        assertEquals(1.08, trip.energyKwh!!, 0.01) // 1.8 % of 60 kWh
        assertEquals(10.8, trip.consumptionKwhPer100()!!, 0.1)
        assertEquals(60.0, trip.maxSpeedKmh, 0.01)
    }

    @Test
    fun usesSpeedWhenThereIsNoOdometer() {
        val rec = TripRecorder(capacityKwh = { 60.0 }, endAfterParkedMs = 1_000)
        var t = 0L
        for (i in 0..360) {
            rec.onSample(car(t, 30.0, Gear.D))
            t += 1_000
        } // 6 minutes at 30 km/h = 3 km
        val trip = assertNotNull(rec.flush())
        assertEquals(3.0, trip.distanceKm, 0.05)
        assertNull(trip.energyKwh)
    }

    @Test
    fun dropsTinyTrips() {
        val rec = TripRecorder(capacityKwh = { 60.0 })
        rec.onSample(car(0, 10.0, Gear.D))
        rec.onSample(car(1_000, 10.0, Gear.D))
        assertNull(rec.flush())
    }

    @Test
    fun recordsAChargingSession() {
        val rec = ChargeRecorder(capacityKwh = { 60.0 }, startAfterMs = 10_000, endAfterMs = 10_000)
        var t = 0L
        var session: com.genestjanramirez.gendrive.core.trip.ChargeSession? = null
        // 1 hour at 7 kW.
        for (i in 0..3600) {
            session = rec.onSample(car(t, 0.0, Gear.P, soc = 40.0 + i * 0.003, power = 7.0)) ?: session
            t += 1_000
        }
        for (i in 0..11) {
            session = rec.onSample(car(t, 0.0, Gear.P, soc = 50.8, power = 0.0)) ?: session
            t += 1_000
        }
        val s = assertNotNull(session)
        assertEquals(6.98, s.energyKwh, 0.05)
        assertFalse(s.isDcFast)
    }

    @Test
    fun costsAndSavings() {
        val settings = CostSettings(pricePerKwh = 12.0, chargingLossPct = 10.0, petrolPricePerLitre = 60.0, petrolLitresPer100Km = 8.0)
        assertEquals(133.33, EnergyMath.electricityCost(10.0, 12.0, 10.0), 0.01)
        assertEquals(480.0, EnergyMath.petrolCost(100.0, 8.0, 60.0), 0.001)
        val trip = com.genestjanramirez.gendrive.core.trip.Trip("a", 0, 1, distanceKm = 100.0, energyKwh = 15.0)
        val summary = TripStats.summarise(listOf(trip), settings)
        assertEquals(200.0, summary.electricityCost, 0.01)
        assertEquals(280.0, summary.saved, 0.01)
        assertEquals(15.0, summary.consumptionKwhPer100!!, 0.001)
    }

    @Test
    fun comparesThisWeekWithLastWeek() {
        val day = 24L * 3_600_000
        val now = 30 * day
        fun trip(daysAgo: Long, km: Double, kwh: Double) =
            com.genestjanramirez.gendrive.core.trip.Trip("t$daysAgo", now - daysAgo * day, now - daysAgo * day + 1, km, energyKwh = kwh)
        val trips = listOf(trip(2, 50.0, 6.0), trip(9, 50.0, 7.5)) // 12 vs 15 kWh/100 km
        assertEquals(-20.0, TripStats.weekOverWeekChangePct(trips, now)!!, 0.001)
        assertNull(TripStats.weekOverWeekChangePct(listOf(trip(2, 5.0, 1.0), trip(9, 50.0, 7.5)), now))
    }

    @Test
    fun tagsDemoTrips() {
        val rec = TripRecorder(capacityKwh = { 55.4 })
        var t = 0L
        repeat(120) {
            rec.onSample(car(t, 40.0, Gear.D).copy(source = DataSource.DEMO))
            t += 1_000
        }
        assertTrue(assertNotNull(rec.flush()).demo)
    }

    @Test
    fun normalisesRawCarUnits() {
        assertEquals(250.0, Units.tyreToKpa(2.5)!!, 0.001) // bar
        assertEquals(248.2, Units.tyreToKpa(36)!!, 0.1) // psi
        assertEquals(240.0, Units.tyreToKpa(240)!!, 0.001) // kPa
        assertNull(Units.tyreToKpa(0))
        assertNull(Units.tyreToKpa(255 * 10))
        assertEquals(12.6, Units.auxVolts(126)!!, 0.001)
        assertEquals(12.6, Units.auxVolts(12600)!!, 0.001)
        assertNull(Units.soc(0))
        assertEquals(Gear.D, Gear.fromBydCode(4))
        assertEquals(Gear.P, Gear.fromLetter(" p "))
    }
}
