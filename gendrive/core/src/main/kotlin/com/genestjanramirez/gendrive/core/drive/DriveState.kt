package com.genestjanramirez.gendrive.core.drive

import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.VehicleState

enum class Motion { PARKED, MOVING }

/**
 * Decides whether the car is moving, with hysteresis so a crawl in traffic
 * does not flicker the UI between drive and park layouts.
 *
 * Moving starts at [startMovingKmh] in any gear except P.
 * Moving ends at once in P, or after the car has been below 1 km/h for [stopHoldMs].
 */
class DriveStateMachine(
    private val startMovingKmh: Double = 5.0,
    private val stopHoldMs: Long = 3_000L,
) {
    var motion: Motion = Motion.PARKED
        private set

    private var slowSinceMs: Long? = null

    fun update(state: VehicleState): Motion = update(state.speedKmh, state.gear, state.timestampMs)

    fun update(speedKmh: Double?, gear: Gear, nowMs: Long): Motion {
        when (motion) {
            Motion.PARKED -> if (speedKmh != null && speedKmh >= startMovingKmh && gear != Gear.P) {
                motion = Motion.MOVING
                slowSinceMs = null
            }
            Motion.MOVING -> when {
                gear == Gear.P -> {
                    motion = Motion.PARKED
                    slowSinceMs = null
                }
                speedKmh == null || speedKmh < 1.0 -> {
                    val since = slowSinceMs ?: nowMs.also { slowSinceMs = it }
                    if (nowMs - since >= stopHoldMs) {
                        motion = Motion.PARKED
                        slowSinceMs = null
                    }
                }
                else -> slowSinceMs = null
            }
        }
        return motion
    }
}

/**
 * GenDrive's video rule: the picture of a video app shows only when the car is in Park.
 * While the car can move, the picture is covered and the sound keeps playing.
 *
 * Deliberately conservative: a red light is not Park. When there is no car data
 * at all we cannot tell, so GenDrive does not interfere (the car's own rules apply).
 */
object VideoGuardPolicy {
    /** Stationary time needed when the gear is unknown but speed is known. */
    const val STOPPED_HOLD_MS = 10_000L

    fun pictureAllowed(state: VehicleState?, stoppedForMs: Long, includeDemoData: Boolean = false): Boolean {
        if (state == null) return true
        when (state.source) {
            DataSource.NONE -> return true
            DataSource.DEMO -> if (!includeDemoData) return true
            DataSource.BYD -> Unit
        }
        if (state.gear == Gear.P) return true
        if (state.gear != Gear.UNKNOWN) return false
        val speed = state.speedKmh ?: return true
        return speed < 1.0 && stoppedForMs >= STOPPED_HOLD_MS
    }

    /**
     * BYD's own screens that GenDrive must never draw over: the camera (360 view and
     * reversing camera), warnings, the system UI and the launcher.
     */
    val neverCover: Set<String> = setOf(
        "com.byd.avc",
        "com.byd.warning",
        "com.byd.systemui",
        "com.byd.launcher",
        "com.android.systemui",
    )

    /**
     * Whether to draw the "audio only" cover right now. Safety first: in reverse the
     * camera must always be visible, so the answer is no regardless of anything else.
     * Only a known video app in the foreground is ever covered.
     */
    fun shouldCover(state: VehicleState?, stoppedForMs: Long, foregroundPackage: String?, includeDemoData: Boolean = false): Boolean {
        if (state?.gear == Gear.R) return false
        if (foregroundPackage == null || foregroundPackage in neverCover) return false
        if (!VideoApps.isVideoApp(foregroundPackage)) return false
        return !pictureAllowed(state, stoppedForMs, includeDemoData)
    }
}

/** Apps whose picture is hidden while the car can move. Audio is never stopped. */
object VideoApps {
    val packages: Set<String> = setOf(
        "com.google.android.youtube",
        "com.google.android.apps.youtube.kids",
        "com.netflix.mediaclient",
        "com.vuclip.viu",
        "com.amazon.avod.thirdpartyclient",
        "com.disney.disneyplus",
        "com.wbd.stream",
        "com.hbo.hbonow",
        "com.iqiyi.i18n",
        "com.tencent.qqlivei18n",
        "com.bstar.intl",
        "org.videolan.vlc",
        "com.mxtech.videoplayer.ad",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.facebook.katana",
        "com.instagram.android",
        "tv.twitch.android.app",
    )

    fun isVideoApp(packageName: String?): Boolean = packageName != null && packageName in packages
}
