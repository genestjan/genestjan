package com.genestjanramirez.gendrive.core.diagnostics

/**
 * The self-test that tells us what a given BYD trim actually exposes. The Android
 * side loads each candidate device by reflection, calls its no-argument getters,
 * and records what came back; this core half holds the list of devices to look
 * for and formats the shareable report. Keeping the catalogue and the formatting
 * here means they are unit-tested and the same on every car.
 *
 * Why discovery instead of a fixed checklist: every BYD model and firmware exposes
 * a different slice of the car API, and the method names for doors, locks, climate
 * control, battery health and cell temperatures are not the same across trims. So
 * rather than guess names and wrongly report a feature "missing", GenDrive lists
 * the real methods on whatever devices load. The owner sends one report back and
 * we build the car-side features against what is genuinely there.
 */
object Diagnostics {
    /**
     * Class names under `android.hardware.bydauto.*` to probe. The first eight are
     * the ones GenDrive already reads in production (known good on DiLink 3). The
     * rest are candidates: probing them reveals controls and extra telemetry on
     * trims that have them, and is simply skipped on trims that do not.
     */
    val candidateDevices: List<String> = listOf(
        // Production reads
        "speed.BYDAutoSpeedDevice",
        "gearbox.BYDAutoGearboxDevice",
        "statistic.BYDAutoStatisticDevice",
        "charging.BYDAutoChargingDevice",
        "tyre.BYDAutoTyreDevice",
        "instrument.BYDAutoInstrumentDevice",
        "ac.BYDAutoAcDevice",
        "power.BYDAutoPowerDevice",
        // Candidates we want to discover for parity (controls, health, motor telemetry)
        "bcm.BYDAutoBcmDevice",
        "door.BYDAutoDoorDevice",
        "window.BYDAutoWindowDevice",
        "lock.BYDAutoLockDevice",
        "seat.BYDAutoSeatDevice",
        "light.BYDAutoLightDevice",
        "sunroof.BYDAutoSunroofDevice",
        "battery.BYDAutoBatteryDevice",
        "motor.BYDAutoMotorDevice",
        "signal.BYDAutoSignalDevice",
        "bodywork.BYDAutoBodyworkDevice",
    )

    /** The number of devices GenDrive already relies on; the rest are discovery. */
    const val PRODUCTION_DEVICE_COUNT = 8

    /** Getter prefixes that are safe to call blind: they read, they do not act. */
    val readPrefixes: List<String> = listOf("get", "is", "query", "read", "has")
}

/** One value read back from a device getter during the self-test. */
data class Reading(val method: String, val value: String)

/** A candidate device and what it answered (or that it was absent). */
data class DeviceProbe(
    val className: String,
    val present: Boolean,
    val readings: List<Reading> = emptyList(),
    val note: String? = null,
)

/** The head-unit facts worth sending alongside the device probes. */
data class SystemInfo(
    val carModel: String,
    val firmware: String,
    val androidSdk: Int,
    val countryCode: String? = null,
    val storageFreeMb: Long? = null,
    val storageTotalMb: Long? = null,
    val appVersion: String? = null,
)

object DiagnosticsReport {
    /** A plain-text report the owner can screenshot or paste back. No private data. */
    fun text(system: SystemInfo, devices: List<DeviceProbe>): String {
        val present = devices.count { it.present }
        val sb = StringBuilder()
        sb.appendLine("GenDrive diagnostics")
        system.appVersion?.let { sb.appendLine("App: $it") }
        sb.append("Car: ${system.carModel} · firmware ${system.firmware} · Android SDK ${system.androidSdk}")
        system.countryCode?.let { sb.append(" · country $it") }
        sb.appendLine()
        if (system.storageTotalMb != null && system.storageFreeMb != null) {
            sb.appendLine("Storage: ${system.storageFreeMb} of ${system.storageTotalMb} MB free")
        }
        sb.appendLine("BYD car API: $present of ${devices.size} devices present")
        sb.appendLine()
        for (d in devices) {
            if (d.present) {
                sb.appendLine("[${d.className}]  present")
                if (d.readings.isEmpty()) {
                    sb.appendLine("  (no readable getters)")
                } else {
                    for (r in d.readings) sb.appendLine("  ${r.method} = ${r.value}")
                }
            } else {
                sb.appendLine("[${d.className}]  —  ${d.note ?: "not on this car"}")
            }
            sb.appendLine()
        }
        return sb.toString().trimEnd() + "\n"
    }
}
