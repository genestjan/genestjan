package com.genestjanramirez.gendrive.core.integrations

import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.math.roundToInt

/**
 * Publishes the car to Home Assistant over MQTT, using HA's own discovery
 * convention so every sensor appears on its own with no YAML to edit.
 *
 * The flow a caller follows once:
 *   1. connect to the broker, set the last-will to [availability] offline on [availabilityTopic]
 *   2. publish every [discoveryMessages] (retained) so HA creates the device and sensors
 *   3. publish [availability] online
 *   4. publish a [stateMessage] whenever the car data changes
 *
 * This object builds the exact topics and JSON; it does no networking, so it is
 * pure and unit-tested. The Android side owns the MQTT client.
 */
object HomeAssistant {
    data class MqttMessage(val topic: String, val payload: String, val retain: Boolean)

    /** One reading to expose, and how HA should present it. */
    private data class Sensor(
        val key: String,
        val name: String,
        val unit: String? = null,
        val deviceClass: String? = null,
        val icon: String? = null,
        /** A binary_sensor is on/off; a plain sensor is a value. */
        val binary: Boolean = false,
        val value: (VehicleState) -> Any?,
    )

    private val sensors = listOf(
        Sensor("soc", "Battery", "%", "battery") { it.socPercent?.roundToInt() },
        Sensor("range", "Range", "km", "distance") { it.rangeKm },
        Sensor("speed", "Speed", "km/h", "speed") { it.speedKmh?.roundToInt() },
        Sensor("gear", "Gear", icon = "mdi:car-shift-pattern") { it.gear.label },
        Sensor("charge_power", "Charge power", "kW", "power") { it.chargePowerKw },
        Sensor("charge_minutes_left", "Charge time left", "min", "duration") { it.chargeMinutesLeft },
        Sensor("battery_temp", "Battery temperature", "°C", "temperature") { it.batteryTempC },
        Sensor("outside_temp", "Outside temperature", "°C", "temperature") { it.outsideTempC },
        Sensor("odometer", "Odometer", "km", "distance") { it.odometerKm?.roundToInt() },
        Sensor("aux_voltage", "12V battery", "V", "voltage") { it.auxBatteryVolts },
        Sensor("consumption", "Consumption", "kWh/100km", icon = "mdi:lightning-bolt") { it.consumptionKwhPer100Km },
        Sensor("tyre_fl", "Tyre front left", "kPa", "pressure") { it.tyres?.frontLeftKpa?.roundToInt() },
        Sensor("tyre_fr", "Tyre front right", "kPa", "pressure") { it.tyres?.frontRightKpa?.roundToInt() },
        Sensor("tyre_rl", "Tyre rear left", "kPa", "pressure") { it.tyres?.rearLeftKpa?.roundToInt() },
        Sensor("tyre_rr", "Tyre rear right", "kPa", "pressure") { it.tyres?.rearRightKpa?.roundToInt() },
        Sensor("charging", "Charging", deviceClass = "battery_charging", binary = true) { it.isCharging },
        Sensor("plugged_in", "Plugged in", deviceClass = "plug", binary = true) { it.pluggedIn },
    )

    fun stateTopic(nodeId: String): String = "gendrive/$nodeId/state"

    fun availabilityTopic(nodeId: String): String = "gendrive/$nodeId/status"

    fun availability(nodeId: String, online: Boolean): MqttMessage =
        MqttMessage(availabilityTopic(nodeId), if (online) "online" else "offline", retain = true)

    /** The retained discovery configs that make HA create the device and its sensors. */
    fun discoveryMessages(
        nodeId: String,
        deviceName: String,
        discoveryPrefix: String = "homeassistant",
    ): List<MqttMessage> {
        val device = buildJsonObject {
            put("identifiers", buildJsonArray { add("gendrive_$nodeId") })
            put("name", deviceName)
            put("manufacturer", "BYD")
            put("model", deviceName)
            put("sw_version", "GenDrive")
        }
        return sensors.map { s ->
            val component = if (s.binary) "binary_sensor" else "sensor"
            val config = buildJsonObject {
                put("name", s.name)
                put("unique_id", "gendrive_${nodeId}_${s.key}")
                put("object_id", "gendrive_${nodeId}_${s.key}")
                put("state_topic", stateTopic(nodeId))
                put("availability_topic", availabilityTopic(nodeId))
                if (s.binary) {
                    put("payload_on", "true")
                    put("payload_off", "false")
                    put("value_template", "{{ value_json.${s.key} }}")
                } else {
                    // A reading that is absent this cycle is published as null; skip it so HA keeps the last value.
                    put("value_template", "{% if value_json.${s.key} is not none %}{{ value_json.${s.key} }}{% endif %}")
                }
                s.unit?.let { put("unit_of_measurement", it) }
                s.deviceClass?.let { put("device_class", it) }
                s.icon?.let { put("icon", it) }
                put("device", device)
            }
            MqttMessage(
                topic = "$discoveryPrefix/$component/gendrive_$nodeId/${s.key}/config",
                payload = config.toString(),
                retain = true,
            )
        }
    }

    /** The current reading of every sensor, as one JSON object on the state topic. */
    fun stateMessage(nodeId: String, state: VehicleState): MqttMessage =
        MqttMessage(stateTopic(nodeId), stateJson(state).toString(), retain = false)

    fun stateJson(state: VehicleState): JsonObject = buildJsonObject {
        for (s in sensors) {
            when (val v = s.value(state)) {
                null -> put(s.key, JsonPrimitive(null as String?))
                is Boolean -> put(s.key, v)
                is Int -> put(s.key, v)
                is Double -> put(s.key, roundTo(v, 2))
                else -> put(s.key, v.toString())
            }
        }
    }

    private fun roundTo(v: Double, dp: Int): Double {
        var f = 1.0
        repeat(dp) { f *= 10 }
        return (v * f).roundToInt() / f
    }
}
