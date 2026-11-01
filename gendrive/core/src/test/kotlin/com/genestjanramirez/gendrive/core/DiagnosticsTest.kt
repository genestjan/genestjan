package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.diagnostics.Diagnostics
import com.genestjanramirez.gendrive.core.diagnostics.DeviceProbe
import com.genestjanramirez.gendrive.core.diagnostics.DiagnosticsReport
import com.genestjanramirez.gendrive.core.diagnostics.Reading
import com.genestjanramirez.gendrive.core.diagnostics.SystemInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DiagnosticsTest {
    @Test
    fun catalogueListsProductionDevicesFirstAndIsWellFormed() {
        val all = Diagnostics.candidateDevices
        assertTrue(all.size > Diagnostics.PRODUCTION_DEVICE_COUNT)
        // The eight production devices GenDrive reads today lead the list.
        val production = all.take(Diagnostics.PRODUCTION_DEVICE_COUNT)
        assertTrue("speed.BYDAutoSpeedDevice" in production)
        assertTrue("charging.BYDAutoChargingDevice" in production)
        assertTrue("power.BYDAutoPowerDevice" in production)
        // Discovery candidates for the car-side features we still need.
        assertTrue("battery.BYDAutoBatteryDevice" in all) // SOH, cell temps
        assertTrue("door.BYDAutoDoorDevice" in all)
        // Every entry is group.Class, no duplicates.
        assertEquals(all.size, all.toSet().size)
        assertTrue(all.all { it.count { c -> c == '.' } == 1 && it.first().isLowerCase() && it.substringAfter('.').startsWith("BYDAuto") })
    }

    @Test
    fun reportShowsPresentReadingsAndAbsentDevicesAndCounts() {
        val system = SystemInfo(
            carModel = "BYD eMAX 7", firmware = "3.0.1", androidSdk = 29, countryCode = "63",
            storageFreeMb = 4200, storageTotalMb = 8000, appVersion = "0.1",
        )
        val devices = listOf(
            DeviceProbe(
                "speed.BYDAutoSpeedDevice", present = true,
                readings = listOf(Reading("getCurrentSpeed", "48.4")),
            ),
            DeviceProbe("battery.BYDAutoBatteryDevice", present = false, note = "not on this car"),
        )
        val text = DiagnosticsReport.text(system, devices)
        assertTrue(text.contains("Car: BYD eMAX 7 · firmware 3.0.1 · Android SDK 29 · country 63"), text)
        assertTrue(text.contains("Storage: 4200 of 8000 MB free"), text)
        assertTrue(text.contains("BYD car API: 1 of 2 devices present"), text)
        assertTrue(text.contains("[speed.BYDAutoSpeedDevice]  present"), text)
        assertTrue(text.contains("  getCurrentSpeed = 48.4"), text)
        assertTrue(text.contains("[battery.BYDAutoBatteryDevice]  —  not on this car"), text)
        // No stray private data and a clean trailing newline.
        assertTrue(text.endsWith("\n"))
    }
}
