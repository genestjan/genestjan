package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.integrations.Abrp
import com.genestjanramirez.gendrive.core.integrations.HomeAssistant
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.TyrePressures
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class IntegrationsTest {
    private val driving = VehicleState(
        source = DataSource.BYD, timestampMs = 1_000, speedKmh = 48.4, gear = Gear.D,
        socPercent = 78.4, rangeKm = 352, odometerKm = 12480.6, outsideTempC = 31.6, batteryTempC = 29.2,
        tyres = TyrePressures(248.0, 250.0, 244.0, 251.0), auxBatteryVolts = 13.1, consumptionKwhPer100Km = 14.2,
    )
    private val charging = VehicleState(
        source = DataSource.BYD, timestampMs = 2_000, speedKmh = 0.0, gear = Gear.P,
        socPercent = 55.0, rangeKm = 250, pluggedIn = true, chargePowerKw = 48.6, chargeMinutesLeft = 23, batteryTempC = 33.0,
    )

    // ---- Home Assistant ----

    @Test
    fun homeAssistantStateUsesSensorKeysAndRoundsNumbers() {
        val json = HomeAssistant.stateJson(driving)
        assertEquals(78, json["soc"]!!.jsonPrimitive.content.toInt())
        assertEquals(48, json["speed"]!!.jsonPrimitive.content.toInt())
        assertEquals("D", json["gear"]!!.jsonPrimitive.content)
        assertEquals(13.1, json["aux_voltage"]!!.jsonPrimitive.content.toDouble())
        assertEquals(248, json["tyre_fl"]!!.jsonPrimitive.content.toInt())
        assertEquals("false", json["charging"]!!.jsonPrimitive.content)
        // A reading the car did not report this cycle is explicit null, not a stale value or a guess.
        assertTrue(json["charge_power"] is JsonNull)
    }

    @Test
    fun homeAssistantChargingIsTrueOnlyWhenPowerFlowsAndStopped() {
        assertEquals("true", HomeAssistant.stateJson(charging)["charging"]!!.jsonPrimitive.content)
        assertEquals("48.6", HomeAssistant.stateJson(charging)["charge_power"]!!.jsonPrimitive.content)
    }

    @Test
    fun homeAssistantDiscoveryIsRetainedWithDeviceAndStateTopic() {
        val msgs = HomeAssistant.discoveryMessages("eMAX7", "BYD eMAX 7")
        assertTrue(msgs.all { it.retain })
        val soc = msgs.single { it.topic.endsWith("/soc/config") }
        assertEquals("homeassistant/sensor/gendrive_eMAX7/soc/config", soc.topic)
        val cfg = Json.parseToJsonElement(soc.payload).jsonObject
        assertEquals("battery", cfg["device_class"]!!.jsonPrimitive.content)
        assertEquals("gendrive/eMAX7/state", cfg["state_topic"]!!.jsonPrimitive.content)
        assertEquals("gendrive/eMAX7/status", cfg["availability_topic"]!!.jsonPrimitive.content)
        assertEquals("BYD eMAX 7", cfg["device"]!!.jsonObject["name"]!!.jsonPrimitive.content)
        // Charging is a binary_sensor, not a plain sensor.
        val charging = msgs.single { it.topic.endsWith("/charging/config") }
        assertTrue(charging.topic.contains("/binary_sensor/"))
    }

    @Test
    fun homeAssistantAvailabilityIsRetainedOnlineOffline() {
        assertEquals("online", HomeAssistant.availability("eMAX7", true).payload)
        assertEquals("offline", HomeAssistant.availability("eMAX7", false).payload)
        assertTrue(HomeAssistant.availability("eMAX7", false).retain)
    }

    // ---- ABRP ----

    @Test
    fun abrpTelemetryReportsKnownFieldsAndParkedFlag() {
        val tlm = Abrp.telemetry(driving, utcSeconds = 1_700_000_000L)
        assertEquals(1_700_000_000L, tlm["utc"]!!.jsonPrimitive.content.toLong())
        assertEquals(78.4, tlm["soc"]!!.jsonPrimitive.content.toDouble())
        assertEquals(48.4, tlm["speed"]!!.jsonPrimitive.content.toDouble())
        assertEquals(352, tlm["est_battery_range"]!!.jsonPrimitive.content.toInt())
        assertEquals(0, tlm["is_charging"]!!.jsonPrimitive.content.toInt())
        assertEquals(0, tlm["is_parked"]!!.jsonPrimitive.content.toInt())
        // Driving: we do not know battery draw, so power is omitted rather than invented.
        assertFalse(tlm.containsKey("power"))
    }

    @Test
    fun abrpChargingReportsNegativePowerAndParked() {
        val tlm = Abrp.telemetry(charging, utcSeconds = 1_700_000_100L)
        assertEquals(1, tlm["is_charging"]!!.jsonPrimitive.content.toInt())
        assertEquals(1, tlm["is_parked"]!!.jsonPrimitive.content.toInt())
        assertEquals(-48.6, tlm["power"]!!.jsonPrimitive.content.toDouble())
    }

    @Test
    fun abrpUrlEncodesTokenAndTelemetry() {
        val tlm = Abrp.telemetry(charging, utcSeconds = 1_700_000_100L)
        val url = Abrp.sendUrl(apiKey = "gd-key", userToken = "user+token/1", telemetry = tlm)
        assertTrue(url.startsWith("https://api.iternio.com/1/tlm/send?"))
        assertTrue(url.contains("api_key=gd-key"))
        assertTrue(url.contains("token=user%2Btoken%2F1"), url)
        assertTrue(url.contains("tlm=%7B"), url) // the JSON "{" is encoded
    }
}
