package com.genestjanramirez.gendrive.adb

import android.content.Context
import com.genestjanramirez.gendrive.notify.GenDriveNotificationListener
import dadb.AdbKeyPair
import dadb.Dadb
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Talks to the car's own ADB service on 127.0.0.1:5555, the way OverDrive does.
 * Only works after the owner has switched on Wireless ADB in the car's hidden
 * developer menu. The first connection makes the car ask "Allow USB debugging?";
 * tick "Always allow" and tap Allow.
 *
 * GenDrive only ever runs the fixed commands below, all about GenDrive itself,
 * plus installing an APK the owner picked. There is no free-form shell.
 */
class AdbHelper(private val context: Context) {
    private val keyDir = File(context.filesDir, "adb")
    private val privateKey = File(keyDir, "adbkey")
    private val publicKey = File(keyDir, "adbkey.pub")

    private fun keyPair(): AdbKeyPair {
        if (!privateKey.exists() || !publicKey.exists()) AdbKeyPair.generate(privateKey, publicKey)
        return AdbKeyPair.read(privateKey, publicKey)
    }

    private suspend fun <T> withAdb(block: (Dadb) -> T): Result<T> = withContext(Dispatchers.IO) {
        runCatching {
            Dadb.create("127.0.0.1", 5555, keyPair(), connectTimeout = 5_000, socketTimeout = 60_000).use(block)
        }
    }

    suspend fun test(): Result<String> = withAdb { adb ->
        val firmware = adb.shell("getprop ro.build.display.id").output.trim()
        val country = adb.shell("getprop sys.byd.countrycode").output.trim()
        "Connected. Firmware $firmware" + if (country.isNotEmpty()) ", country code $country." else "."
    }

    /** Grants the special permissions BYD hides from its Settings app. */
    suspend fun grantGenDrivePermissions(): Result<String> = withAdb { adb ->
        val pkg = context.packageName
        val listener = "$pkg/${GenDriveNotificationListener::class.java.name}"
        val commands = listOf(
            "cmd notification allow_listener $listener",
            "appops set $pkg SYSTEM_ALERT_WINDOW allow",
            "appops set $pkg GET_USAGE_STATS allow",
            "appops set $pkg REQUEST_INSTALL_PACKAGES allow",
            "pm grant $pkg android.permission.RECORD_AUDIO",
            "dumpsys deviceidle whitelist +$pkg",
        )
        commands.joinToString("\n") { cmd ->
            val r = adb.shell(cmd)
            val result = r.allOutput.trim().ifEmpty { if (r.exitCode == 0) "ok" else "exit ${r.exitCode}" }
            "• $cmd → $result"
        }
    }

    suspend fun install(apk: File): Result<Unit> = withAdb { it.install(apk, "-r") }
}
