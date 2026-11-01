package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.trip.DriveSample
import com.genestjanramirez.gendrive.core.trip.DrivingDna
import kotlin.test.Test
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DrivingScoreTest {
    // A calm drive: ramp gently to 60 km/h, then hold it.
    private val smooth: List<DriveSample> = buildList {
        var t = 0L
        var v = 0.0
        repeat(60) { add(DriveSample(t, v)); v = (v + 1.0).coerceAtMost(60.0); t += 1000 } // ~0.28 m/s²
        repeat(60) { add(DriveSample(t, 60.0)); t += 1000 } // steady
    }

    // A harsh drive: slam between 0 and 40 km/h every two seconds.
    private val jerky: List<DriveSample> = buildList {
        var t = 0L
        repeat(30) { i -> add(DriveSample(t, if (i % 2 == 0) 0.0 else 40.0)); t += 2000 } // ~5.6 m/s², hard brakes
    }

    @Test
    fun smoothDrivingScoresHigherThanHarshDriving() {
        val s = DrivingDna.score(smooth, consumptionKwhPer100 = 13.0)
        val j = DrivingDna.score(jerky, consumptionKwhPer100 = 13.0)
        assertTrue(s.overall > j.overall, "smooth ${s.overall} should beat jerky ${j.overall}")
        assertTrue(s.smoothness >= 85, "smooth smoothness ${s.smoothness}")
        assertTrue(j.smoothness <= 45, "jerky smoothness ${j.smoothness}")
        assertTrue(j.anticipation < s.anticipation, "jerky should brake harder")
        assertTrue(s.overall in 0..100 && j.overall in 0..100)
        assertTrue(s.grade == "Excellent" || s.grade == "Smooth", s.grade)
    }

    @Test
    fun efficiencyRewardsLowConsumptionAndCanBeUnknown() {
        // Using less than the 15 kWh/100 baseline is full marks; using more drops it.
        assertTrue(DrivingDna.score(smooth, consumptionKwhPer100 = 12.0).efficiency == 100)
        assertTrue(DrivingDna.score(smooth, consumptionKwhPer100 = 30.0).efficiency == 50)
        // No energy data: efficiency is left out, overall still scores from how it was driven.
        val noEnergy = DrivingDna.score(smooth, consumptionKwhPer100 = null)
        assertNull(noEnergy.efficiency)
        assertTrue(noEnergy.overall in 0..100)
    }

    @Test
    fun handlesEmptyAndLoggingGapsWithoutCrashing() {
        val empty = DrivingDna.score(emptyList(), consumptionKwhPer100 = null)
        assertTrue(empty.overall in 0..100)
        // A long gap between two samples must not be read as a huge acceleration.
        val gap = listOf(DriveSample(0, 0.0), DriveSample(30_000, 60.0))
        assertTrue(DrivingDna.score(gap, consumptionKwhPer100 = null).smoothness == 100)
    }
}
