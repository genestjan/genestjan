package com.genestjanramirez.gendrive.vehicle

import android.content.Context
import android.os.Build
import com.genestjanramirez.gendrive.core.drive.DriveStateMachine
import com.genestjanramirez.gendrive.core.drive.Motion
import com.genestjanramirez.gendrive.core.settings.DataMode
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import com.genestjanramirez.gendrive.data.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Facts about the head unit, shown on the Setup screen. */
data class CarInfo(
    val bydApiPresent: Boolean,
    val countryCode: String?,
    val firmware: String,
    val sdkInt: Int,
    val model: String,
)

class VehicleRepository(
    private val context: Context,
    private val settings: SettingsStore,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(VehicleState.EMPTY)
    val state: StateFlow<VehicleState> = _state.asStateFlow()

    private val _motion = MutableStateFlow(Motion.PARKED)
    val motion: StateFlow<Motion> = _motion.asStateFlow()

    val info: CarInfo by lazy {
        CarInfo(
            bydApiPresent = BydApi.isPresent(),
            countryCode = systemProperty("sys.byd.countrycode"),
            firmware = Build.DISPLAY ?: "",
            sdkInt = Build.VERSION.SDK_INT,
            model = listOfNotNull(Build.MANUFACTURER, Build.MODEL).joinToString(" "),
        )
    }

    private var job: Job? = null
    private val drive = DriveStateMachine()

    /** Starts polling. Safe to call many times. */
    @Synchronized
    fun start() {
        if (job?.isActive == true) return
        job = scope.launch(Dispatchers.IO) {
            val byd = BydVehicleSource(context)
            val bydOpen = byd.open()
            val demo = DemoVehicleSource { settings.current.cost.batteryCapacityKwh }
            while (isActive) {
                val now = System.currentTimeMillis()
                val next = when (settings.current.dataMode) {
                    DataMode.AUTO -> if (bydOpen) byd.read(now, _state.value) else demo.read(now)
                    DataMode.CAR_ONLY -> if (bydOpen) byd.read(now, _state.value) else VehicleState.EMPTY.copy(timestampMs = now)
                    DataMode.DEMO -> demo.read(now)
                }
                _state.value = next
                _motion.value = drive.update(next)
                delay(500)
            }
        }
    }

    companion object {
        /** Reads a system property such as sys.byd.countrycode. Hidden API, so reflection. */
        fun systemProperty(key: String): String? = try {
            val c = Class.forName("android.os.SystemProperties")
            (c.getMethod("get", String::class.java).invoke(null, key) as? String)?.takeIf { it.isNotBlank() }
        } catch (t: Throwable) {
            null
        }
    }
}
