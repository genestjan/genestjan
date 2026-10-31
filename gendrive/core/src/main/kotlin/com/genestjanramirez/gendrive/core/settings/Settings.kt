package com.genestjanramirez.gendrive.core.settings

import com.genestjanramirez.gendrive.core.trip.CostSettings
import com.genestjanramirez.gendrive.core.vehicle.DistanceUnit
import com.genestjanramirez.gendrive.core.vehicle.PressureUnit
import com.genestjanramirez.gendrive.core.voice.GeminiProtocol

enum class ThemeMode { AUTO, DARK, LIGHT }

/** Where vehicle data comes from. AUTO uses the car when available, otherwise the demo drive. */
enum class DataMode { AUTO, CAR_ONLY, DEMO }

/** Approximate usable battery sizes. Owners can type their own figure. */
data class BatteryPreset(val model: String, val capacityKwh: Double)

/** Which side of the screen the driver sits. The navigation rail goes on that side. */
enum class DriverSide { LEFT, RIGHT }

object BatteryPresets {
    val all = listOf(
        BatteryPreset("eMAX 7 / M6 Standard (55.4 kWh)", 55.4),
        BatteryPreset("eMAX 7 / M6 Superior (71.8 kWh)", 71.8),
        BatteryPreset("Atto 3 (60.48 kWh)", 60.48),
        BatteryPreset("Atto 3 Standard (49.92 kWh)", 49.92),
        BatteryPreset("Dolphin (44.9 kWh)", 44.9),
        BatteryPreset("Dolphin Extended (60.48 kWh)", 60.48),
        BatteryPreset("Seal (61.4 kWh)", 61.4),
        BatteryPreset("Seal Premium (82.56 kWh)", 82.56),
        BatteryPreset("Sealion 7 (82.56 kWh)", 82.56),
        BatteryPreset("Seagull / Dolphin Mini (38.88 kWh)", 38.88),
        BatteryPreset("Sealion 6 DM-i (18.3 kWh)", 18.3),
        BatteryPreset("Shark 6 DM-i (29.58 kWh)", 29.58),
    )
}

data class GenDriveSettings(
    val ownerName: String = "",
    val carModel: String = BatteryPresets.all.first().model,
    val driverSide: DriverSide = DriverSide.LEFT,
    val theme: ThemeMode = ThemeMode.AUTO,
    val dataMode: DataMode = DataMode.AUTO,
    val distanceUnit: DistanceUnit = DistanceUnit.KM,
    val pressureUnit: PressureUnit = PressureUnit.PSI,
    val cost: CostSettings = CostSettings(),
    val lowTyreKpa: Double = 210.0,
    val lyricsEnabled: Boolean = true,
    /** Lets the video guard react to the demo drive, so it can be tested on a phone. */
    val videoGuardOnDemoData: Boolean = false,
    val homeAddress: String = "",
    val workAddress: String = "",
    val favouritePlaces: List<String> = emptyList(),
    /** The assistant's name, spoken and shown. An original character, renameable. */
    val assistantName: String = "Gen",
    /** The owner's own Gemini API key (aistudio.google.com/apikey). Empty means offline commands only. */
    val geminiApiKey: String = "",
    val geminiModel: String = GeminiProtocol.DEFAULT_MODEL,
    /** A text-to-speech voice name; empty picks the most British-sounding voice installed. */
    val voiceId: String = "",
    val spokenGreeting: Boolean = true,
    val spokenTripSummaries: Boolean = true,
    val spokenWarnings: Boolean = true,
    val dockPackages: List<String> = listOf(
        "com.spotify.music",
        "com.google.android.apps.maps",
        "com.waze",
        "com.google.android.youtube",
    ),
)
