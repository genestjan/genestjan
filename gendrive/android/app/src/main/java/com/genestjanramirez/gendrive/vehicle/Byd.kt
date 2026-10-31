package com.genestjanramirez.gendrive.vehicle

import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.util.Log
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.TyrePressures
import com.genestjanramirez.gendrive.core.vehicle.Units
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import java.lang.reflect.Method

private const val TAG = "GenDriveByd"

/**
 * BYD's client library checks permissions on our side before it talks to the car
 * service. Real enforcement happens in the car service itself, so answering
 * "granted" here only skips a duplicate client-side check. The same pattern is
 * used by OverDrive (MIT) and the byd-apps research apps.
 */
internal class PermissionBypassContext(base: Context) : ContextWrapper(base) {
    override fun checkCallingOrSelfPermission(permission: String): Int = PackageManager.PERMISSION_GRANTED
    override fun checkSelfPermission(permission: String): Int = PackageManager.PERMISSION_GRANTED
    override fun checkPermission(permission: String, pid: Int, uid: Int): Int = PackageManager.PERMISSION_GRANTED
    override fun enforceCallingOrSelfPermission(permission: String, message: String?) = Unit
    override fun enforcePermission(permission: String, pid: Int, uid: Int, message: String?) = Unit
    override fun enforceCallingPermission(permission: String, message: String?) = Unit
}

/** A BYD car-API device (speed, gearbox, ...) reached by reflection, so the APK also runs on phones. */
internal class BydDevice(private val instance: Any, val name: String) {
    private val methods = HashMap<String, Method?>()

    fun call(method: String, vararg args: Any): Any? {
        val key = "$method/${args.size}"
        // Remember misses too: a trim without this method should not be re-scanned twice a second.
        val m = if (methods.containsKey(key)) {
            methods[key]
        } else {
            instance.javaClass.methods.firstOrNull { it.name == method && it.parameterTypes.size == args.size }.also { methods[key] = it }
        } ?: return null
        return try {
            m.invoke(instance, *args)
        } catch (t: Throwable) {
            Log.d(TAG, "$name.$method failed: ${t.cause?.message ?: t.message}")
            null
        }
    }

    fun number(method: String, vararg args: Any): Number? = call(method, *args) as? Number

    fun string(method: String): String? = call(method) as? String
}

internal object BydApi {
    private const val PKG = "android.hardware.bydauto"

    fun isPresent(): Boolean = try {
        Class.forName("$PKG.speed.BYDAutoSpeedDevice")
        true
    } catch (t: Throwable) {
        false
    }

    fun device(context: Context, className: String): BydDevice? = try {
        val cls = Class.forName("$PKG.$className")
        val getInstance = cls.getMethod("getInstance", Context::class.java)
        getInstance.invoke(null, context)?.let { BydDevice(it, className.substringAfterLast('.')) }
    } catch (t: Throwable) {
        Log.d(TAG, "No $className: ${t.message}")
        null
    }
}

/**
 * Reads the car through BYD's on-board Android services (DiLink 3 tested by the
 * community; DiLink 5 uses a different SDK and is on the roadmap).
 * Method names come from public research: OverDrive (MIT) and
 * github.com/wheregoes/byd-dolphin-hacking.
 */
internal class BydVehicleSource(context: Context) {
    private val ctx = PermissionBypassContext(context.applicationContext)
    private var speed: BydDevice? = null
    private var gearbox: BydDevice? = null
    private var statistic: BydDevice? = null
    private var charging: BydDevice? = null
    private var tyre: BydDevice? = null
    private var instrument: BydDevice? = null
    private var ac: BydDevice? = null
    private var power: BydDevice? = null
    private var tick = 0L

    /** True when at least the core devices answered. */
    fun open(): Boolean {
        if (!BydApi.isPresent()) return false
        speed = BydApi.device(ctx, "speed.BYDAutoSpeedDevice")
        gearbox = BydApi.device(ctx, "gearbox.BYDAutoGearboxDevice")
        statistic = BydApi.device(ctx, "statistic.BYDAutoStatisticDevice")
        charging = BydApi.device(ctx, "charging.BYDAutoChargingDevice")
        tyre = BydApi.device(ctx, "tyre.BYDAutoTyreDevice")
        instrument = BydApi.device(ctx, "instrument.BYDAutoInstrumentDevice")
        ac = BydApi.device(ctx, "ac.BYDAutoAcDevice")
        power = BydApi.device(ctx, "power.BYDAutoPowerDevice")
        return speed != null || statistic != null
    }

    /** Speed and gear every call; slower-changing values every 10th call, reusing [previous] otherwise. */
    fun read(nowMs: Long, previous: VehicleState): VehicleState {
        val slow = tick++ % 10 == 0L
        val gear = gearbox?.number("getGearboxAutoModeType")?.let { Gear.fromBydCode(it.toInt()) }
            ?.takeIf { it != Gear.UNKNOWN }
            ?: Gear.fromLetter(gearbox?.string("getGearboxCode"))
        val base = previous.copy(
            source = DataSource.BYD,
            timestampMs = nowMs,
            speedKmh = Units.speed(speed?.number("getCurrentSpeed")),
            gear = gear,
        )
        if (!slow) {
            // Charging power matters for the session log, so read it with the fast group too.
            return base.copy(chargePowerKw = Units.chargePower(charging?.number("getChargePower")) ?: base.chargePowerKw)
        }
        val gun = charging?.number("getChargingGunState")?.toInt()
        return base.copy(
            socPercent = Units.soc(statistic?.number("getElecPercentageValue")) ?: base.socPercent,
            rangeKm = Units.rangeKm(statistic?.number("getElecDrivingRangeValue")) ?: base.rangeKm,
            odometerKm = Units.odometer(statistic?.number("getTotalMileageValue")) ?: base.odometerKm,
            pluggedIn = gun?.let { it in 2..5 },
            chargePowerKw = Units.chargePower(charging?.number("getChargePower")),
            chargeMinutesLeft = charging?.number("getRemainChargingTime")?.toInt()?.takeIf { it in 1..2000 },
            batteryTempC = Units.temperature(charging?.number("getBatteryTemp")),
            outsideTempC = Units.temperature(instrument?.number("getOutCarTemperature"))
                ?: Units.temperature(ac?.number("getTemprature", 4)),
            tyres = TyrePressures(
                Units.tyreToKpa(tyre?.number("getTyrePressureLeftFront")),
                Units.tyreToKpa(tyre?.number("getTyrePressureRightFront")),
                Units.tyreToKpa(tyre?.number("getTyrePressureLeftRear")),
                Units.tyreToKpa(tyre?.number("getTyrePressureRightRear")),
            ).takeIf { it.hasAny },
            auxBatteryVolts = Units.auxVolts(power?.number("getBatteryVoltage")),
            consumptionKwhPer100Km = Units.consumption(instrument?.number("getLast50KmPowerConsume")),
        )
    }
}
