package com.genestjanramirez.gendrive.trips

import android.content.Context
import com.genestjanramirez.gendrive.core.trip.ChargeRecorder
import com.genestjanramirez.gendrive.core.trip.ChargeSession
import com.genestjanramirez.gendrive.core.trip.Trip
import com.genestjanramirez.gendrive.core.trip.TripRecorder
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import com.genestjanramirez.gendrive.data.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/** Trips and charging sessions, kept as small JSON files on the head unit. Nothing leaves the car. */
class TripRepository(context: Context, private val settings: SettingsStore, private val scope: CoroutineScope) {
    private val json = Json { ignoreUnknownKeys = true }
    private val tripsFile = File(context.filesDir, "trips.json")
    private val chargesFile = File(context.filesDir, "charges.json")

    private val _trips = MutableStateFlow(read(tripsFile, ListSerializer(Trip.serializer())))
    val trips: StateFlow<List<Trip>> = _trips.asStateFlow()

    private val _charges = MutableStateFlow(read(chargesFile, ListSerializer(ChargeSession.serializer())))
    val charges: StateFlow<List<ChargeSession>> = _charges.asStateFlow()

    /** The trip that just ended, for the "trip complete" card and spoken summary. */
    private val _finished = MutableStateFlow<Trip?>(null)
    val lastFinished: StateFlow<Trip?> = _finished.asStateFlow()

    private val _events = MutableSharedFlow<Any>(extraBufferCapacity = 4)
    /** Emits each finished [Trip] and [ChargeSession] once, for the voice assistant. */
    val events: SharedFlow<Any> = _events.asSharedFlow()

    private val tripRecorder = TripRecorder({ settings.current.cost.batteryCapacityKwh })
    private val chargeRecorder = ChargeRecorder({ settings.current.cost.batteryCapacityKwh })

    val liveDistanceKm: Double get() = tripRecorder.liveDistanceKm
    val isRecording: Boolean get() = tripRecorder.isRecording

    @Synchronized
    fun onSample(s: VehicleState) {
        if (!s.hasLiveData) return
        tripRecorder.onSample(s)?.let(::addTrip)
        chargeRecorder.onSample(s)?.let(::addCharge)
    }

    @Synchronized
    fun flush() {
        tripRecorder.flush()?.let(::addTrip)
        chargeRecorder.flush()?.let(::addCharge)
    }

    fun dismissFinished() {
        _finished.value = null
    }

    fun clearDemoTrips() {
        _trips.value = _trips.value.filterNot { it.demo }
        save()
    }

    fun clearAll() {
        _trips.value = emptyList()
        _charges.value = emptyList()
        save()
    }

    private fun addTrip(trip: Trip) {
        _trips.value = (listOf(trip) + _trips.value).take(2_000)
        _finished.value = trip
        _events.tryEmit(trip)
        save()
    }

    private fun addCharge(session: ChargeSession) {
        _charges.value = (listOf(session) + _charges.value).take(1_000)
        _events.tryEmit(session)
        save()
    }

    private fun save() {
        val trips = _trips.value
        val charges = _charges.value
        scope.launch(Dispatchers.IO) {
            write(tripsFile, json.encodeToString(ListSerializer(Trip.serializer()), trips))
            write(chargesFile, json.encodeToString(ListSerializer(ChargeSession.serializer()), charges))
        }
    }

    /** Writes to a temp file first so a power cut mid-write cannot corrupt the log. */
    private fun write(file: File, text: String) {
        try {
            val tmp = File(file.parentFile, file.name + ".tmp")
            tmp.writeText(text)
            tmp.renameTo(file)
        } catch (e: Exception) {
            // Out of space: keep the in-memory list; the next save will retry.
        }
    }

    private fun <T> read(file: File, serializer: kotlinx.serialization.KSerializer<List<T>>): List<T> = try {
        if (file.exists()) json.decodeFromString(serializer, file.readText()) else emptyList()
    } catch (e: Exception) {
        emptyList()
    }
}
