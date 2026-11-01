package com.genestjanramirez.gendrive.diagnostics

import android.content.Context
import android.os.Environment
import android.os.StatFs
import com.genestjanramirez.gendrive.core.diagnostics.DeviceProbe
import com.genestjanramirez.gendrive.core.diagnostics.Diagnostics
import com.genestjanramirez.gendrive.core.diagnostics.DiagnosticsReport
import com.genestjanramirez.gendrive.core.diagnostics.Reading
import com.genestjanramirez.gendrive.core.diagnostics.SystemInfo
import com.genestjanramirez.gendrive.vehicle.PermissionBypassContext

/**
 * Runs the self-test on the real head unit: for every candidate BYD device it
 * tries to load the class, get its singleton, and call each no-argument getter,
 * recording what came back. The result is the shareable report from core.
 *
 * It only ever calls zero-argument read methods (get/is/query/read/has), so it
 * observes the car and never commands it. Every call is wrapped, so one missing
 * or throwing method cannot stop the scan. Run it off the main thread.
 */
object DiagnosticsProbe {
    private const val PKG = "android.hardware.bydauto"
    private const val MAX_READINGS_PER_DEVICE = 80
    private const val MAX_VALUE_CHARS = 80

    fun run(
        context: Context,
        carModel: String,
        firmware: String,
        sdkInt: Int,
        countryCode: String?,
        appVersion: String?,
    ): String {
        val ctx = PermissionBypassContext(context.applicationContext)
        val probes = Diagnostics.candidateDevices.map { probeDevice(ctx, it) }
        val system = SystemInfo(
            carModel = carModel,
            firmware = firmware,
            androidSdk = sdkInt,
            countryCode = countryCode,
            storageFreeMb = storageMb(total = false),
            storageTotalMb = storageMb(total = true),
            appVersion = appVersion,
        )
        return DiagnosticsReport.text(system, probes)
    }

    private fun probeDevice(ctx: Context, className: String): DeviceProbe {
        val cls = try {
            Class.forName("$PKG.$className")
        } catch (t: Throwable) {
            return DeviceProbe(className, present = false)
        }
        val instance = try {
            cls.getMethod("getInstance", Context::class.java).invoke(null, ctx)
        } catch (t: Throwable) {
            null
        } ?: return DeviceProbe(className, present = false, note = "class found, no instance on this trim")

        val readings = ArrayList<Reading>()
        val seen = HashSet<String>()
        for (m in instance.javaClass.methods.sortedBy { it.name }) {
            if (m.parameterTypes.isNotEmpty()) continue
            if (Diagnostics.readPrefixes.none { m.name.startsWith(it) }) continue
            if (!isSimpleReturn(m.returnType)) continue
            if (!seen.add(m.name)) continue
            val value = try {
                format(m.invoke(instance))
            } catch (t: Throwable) {
                "error: ${t.cause?.message ?: t.message ?: "threw"}"
            }
            readings.add(Reading(m.name, value))
            if (readings.size >= MAX_READINGS_PER_DEVICE) break
        }
        return DeviceProbe(className, present = true, readings = readings)
    }

    private fun isSimpleReturn(t: Class<*>): Boolean =
        t.isPrimitive ||
            t == java.lang.String::class.java ||
            CharSequence::class.java.isAssignableFrom(t) ||
            Number::class.java.isAssignableFrom(t) ||
            t == java.lang.Boolean::class.java

    private fun format(v: Any?): String = (v?.toString() ?: "null").take(MAX_VALUE_CHARS)

    private fun storageMb(total: Boolean): Long? = try {
        val fs = StatFs(Environment.getDataDirectory().path)
        (if (total) fs.totalBytes else fs.availableBytes) / (1024 * 1024)
    } catch (t: Throwable) {
        null
    }
}
