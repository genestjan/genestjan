package com.genestjanramirez.gendrive.core.vehicle

/** Where a reading came from. DEMO is the built-in simulator used on phones and emulators. */
enum class DataSource { BYD, DEMO, NONE }

enum class Gear(val label: String) {
    P("P"), R("R"), N("N"), D("D"), M("M"), S("S"), UNKNOWN("-");

    val isMovingGear: Boolean get() = this == R || this == D || this == M || this == S

    companion object {
        /** BYDAutoGearboxDevice.getGearboxAutoModeType(): 1=P 2=R 3=N 4=D 5=M 6=S. */
        fun fromBydCode(code: Int?): Gear = when (code) {
            1 -> P
            2 -> R
            3 -> N
            4 -> D
            5 -> M
            6 -> S
            else -> UNKNOWN
        }

        /** BYDAutoGearboxDevice.getGearboxCode() on trims that return a letter. */
        fun fromLetter(raw: String?): Gear = when (raw?.trim()?.uppercase()) {
            "P" -> P
            "R" -> R
            "N" -> N
            "D" -> D
            "M" -> M
            "S" -> S
            else -> UNKNOWN
        }
    }
}

/** Tyre pressures, always stored in kPa so the UI can convert once. */
data class TyrePressures(
    val frontLeftKpa: Double?,
    val frontRightKpa: Double?,
    val rearLeftKpa: Double?,
    val rearRightKpa: Double?,
) {
    val all: List<Double?> get() = listOf(frontLeftKpa, frontRightKpa, rearLeftKpa, rearRightKpa)
    val hasAny: Boolean get() = all.any { it != null }
    fun lowest(): Double? = all.filterNotNull().minOrNull()
    fun anyBelow(thresholdKpa: Double): Boolean = all.any { it != null && it < thresholdKpa }
}

/**
 * One snapshot of the car. Every field is nullable because BYD trims expose
 * different subsets of the car API; the UI shows a dash for anything missing.
 */
data class VehicleState(
    val source: DataSource = DataSource.NONE,
    val timestampMs: Long = 0L,
    val speedKmh: Double? = null,
    val gear: Gear = Gear.UNKNOWN,
    val socPercent: Double? = null,
    val rangeKm: Int? = null,
    val odometerKm: Double? = null,
    val pluggedIn: Boolean? = null,
    val chargePowerKw: Double? = null,
    val chargeMinutesLeft: Int? = null,
    val batteryTempC: Double? = null,
    val outsideTempC: Double? = null,
    val tyres: TyrePressures? = null,
    val auxBatteryVolts: Double? = null,
    val consumptionKwhPer100Km: Double? = null,
) {
    /** Charging means power flowing in while the car is not moving. */
    val isCharging: Boolean
        get() = (chargePowerKw ?: 0.0) >= 0.3 && (speedKmh ?: 0.0) < 1.0

    val hasLiveData: Boolean get() = source != DataSource.NONE

    companion object {
        val EMPTY = VehicleState()
    }
}
