package com.genestjanramirez.gendrive.data

import android.content.Context
import com.genestjanramirez.gendrive.core.settings.GenDriveSettings
import com.genestjanramirez.gendrive.core.trip.CostSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Settings kept in SharedPreferences and exposed as a flow the UI can watch. */
class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("gendrive_settings", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(load())
    val state: StateFlow<GenDriveSettings> = _state.asStateFlow()
    val current: GenDriveSettings get() = _state.value

    fun update(block: (GenDriveSettings) -> GenDriveSettings) {
        val next = block(_state.value)
        _state.value = next
        save(next)
    }

    fun updateCost(block: (CostSettings) -> CostSettings) = update { it.copy(cost = block(it.cost)) }

    private fun load(): GenDriveSettings {
        val d = GenDriveSettings()
        val c = d.cost
        return GenDriveSettings(
            ownerName = prefs.getString("ownerName", d.ownerName) ?: d.ownerName,
            carModel = prefs.getString("carModel", d.carModel) ?: d.carModel,
            driverSide = enumOr(prefs.getString("driverSide", null), d.driverSide),
            theme = enumOr(prefs.getString("theme", null), d.theme),
            dataMode = enumOr(prefs.getString("dataMode", null), d.dataMode),
            distanceUnit = enumOr(prefs.getString("distanceUnit", null), d.distanceUnit),
            pressureUnit = enumOr(prefs.getString("pressureUnit", null), d.pressureUnit),
            cost = CostSettings(
                currency = prefs.getString("currency", c.currency) ?: c.currency,
                pricePerKwh = double("pricePerKwh", c.pricePerKwh),
                chargingLossPct = double("chargingLossPct", c.chargingLossPct),
                petrolPricePerLitre = double("petrolPricePerLitre", c.petrolPricePerLitre),
                petrolLitresPer100Km = double("petrolLitresPer100Km", c.petrolLitresPer100Km),
                batteryCapacityKwh = double("batteryCapacityKwh", c.batteryCapacityKwh),
            ),
            lowTyreKpa = double("lowTyreKpa", d.lowTyreKpa),
            lyricsEnabled = prefs.getBoolean("lyricsEnabled", d.lyricsEnabled),
            videoGuardOnDemoData = prefs.getBoolean("videoGuardOnDemoData", d.videoGuardOnDemoData),
            homeAddress = prefs.getString("homeAddress", d.homeAddress) ?: d.homeAddress,
            workAddress = prefs.getString("workAddress", d.workAddress) ?: d.workAddress,
            favouritePlaces = list("favouritePlaces") ?: d.favouritePlaces,
            assistantName = prefs.getString("assistantName", d.assistantName)?.ifBlank { d.assistantName } ?: d.assistantName,
            geminiApiKey = prefs.getString("geminiApiKey", d.geminiApiKey) ?: d.geminiApiKey,
            geminiModel = prefs.getString("geminiModel", d.geminiModel)?.ifBlank { d.geminiModel } ?: d.geminiModel,
            voiceId = prefs.getString("voiceId", d.voiceId) ?: d.voiceId,
            spokenGreeting = prefs.getBoolean("spokenGreeting", d.spokenGreeting),
            spokenTripSummaries = prefs.getBoolean("spokenTripSummaries", d.spokenTripSummaries),
            spokenWarnings = prefs.getBoolean("spokenWarnings", d.spokenWarnings),
            dockPackages = list("dockPackages") ?: d.dockPackages,
        )
    }

    private fun save(s: GenDriveSettings) {
        prefs.edit()
            .putString("ownerName", s.ownerName)
            .putString("carModel", s.carModel)
            .putString("driverSide", s.driverSide.name)
            .putString("theme", s.theme.name)
            .putString("dataMode", s.dataMode.name)
            .putString("distanceUnit", s.distanceUnit.name)
            .putString("pressureUnit", s.pressureUnit.name)
            .putString("currency", s.cost.currency)
            .putString("pricePerKwh", s.cost.pricePerKwh.toString())
            .putString("chargingLossPct", s.cost.chargingLossPct.toString())
            .putString("petrolPricePerLitre", s.cost.petrolPricePerLitre.toString())
            .putString("petrolLitresPer100Km", s.cost.petrolLitresPer100Km.toString())
            .putString("batteryCapacityKwh", s.cost.batteryCapacityKwh.toString())
            .putString("lowTyreKpa", s.lowTyreKpa.toString())
            .putBoolean("lyricsEnabled", s.lyricsEnabled)
            .putBoolean("videoGuardOnDemoData", s.videoGuardOnDemoData)
            .putString("homeAddress", s.homeAddress)
            .putString("workAddress", s.workAddress)
            .putString("favouritePlaces", s.favouritePlaces.joinToString("\n"))
            .putString("dockPackages", s.dockPackages.joinToString("\n"))
            .putString("assistantName", s.assistantName)
            .putString("geminiApiKey", s.geminiApiKey)
            .putString("geminiModel", s.geminiModel)
            .putString("voiceId", s.voiceId)
            .putBoolean("spokenGreeting", s.spokenGreeting)
            .putBoolean("spokenTripSummaries", s.spokenTripSummaries)
            .putBoolean("spokenWarnings", s.spokenWarnings)
            .apply()
    }

    private fun double(key: String, default: Double): Double =
        prefs.getString(key, null)?.toDoubleOrNull() ?: default

    private fun list(key: String): List<String>? =
        prefs.getString(key, null)?.split("\n")?.map { it.trim() }?.filter { it.isNotEmpty() }

    private inline fun <reified T : Enum<T>> enumOr(name: String?, default: T): T =
        name?.let { n -> enumValues<T>().firstOrNull { it.name == n } } ?: default
}
