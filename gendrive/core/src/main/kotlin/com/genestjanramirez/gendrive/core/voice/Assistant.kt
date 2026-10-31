package com.genestjanramirez.gendrive.core.voice

import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.util.Locale
import kotlin.math.roundToInt

/** Something the assistant asked GenDrive to do. */
sealed interface AssistantAction {
    data class Navigate(val destination: String) : AssistantAction
    data class SearchNearby(val query: String) : AssistantAction
    data class Media(val action: String) : AssistantAction
    data class OpenApp(val appName: String) : AssistantAction
    data object Status : AssistantAction
}

data class AssistantReply(val speech: String?, val actions: List<AssistantAction>)

/**
 * Understands simple spoken commands with no internet and no AI, so the
 * assistant still works without a Gemini key or signal.
 */
object LocalCommands {
    private val navigate = Regex("""^(?:navigate|take me|drive|directions|go|bring me|route)\s+(?:to\s+)?(.+)$""", RegexOption.IGNORE_CASE)
    private val find = Regex("""^(?:find|search for|show me|where(?:'s| is) (?:the )?nearest|nearest)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+nearby|\s+near me|\s+close by)?$""", RegexOption.IGNORE_CASE)
    private val open = Regex("""^(?:open|launch|start)\s+(.+)$""", RegexOption.IGNORE_CASE)

    fun parse(transcript: String, homeAddress: String, workAddress: String): AssistantAction? {
        val text = transcript.trim().trimEnd('.', '!', '?').lowercase(Locale.US)
            .removePrefix("hey ").removePrefix("ok ").trim()
        if (text.isEmpty()) return null
        when (text) {
            "pause", "stop", "stop music", "pause music", "pause the music" -> return AssistantAction.Media("pause")
            "play", "resume", "play music", "resume music", "continue" -> return AssistantAction.Media("play")
            "next", "skip", "next song", "next track", "skip song", "skip this" -> return AssistantAction.Media("next")
            "previous", "back", "previous song", "previous track", "go back" -> return AssistantAction.Media("previous")
            "status", "car status", "battery", "battery status", "how's the battery", "how is the battery", "range", "what's my range" ->
                return AssistantAction.Status
        }
        if (text in setOf("go home", "take me home", "navigate home", "home") && homeAddress.isNotBlank()) {
            return AssistantAction.Navigate(homeAddress)
        }
        if (text in setOf("go to work", "take me to work", "navigate to work", "work") && workAddress.isNotBlank()) {
            return AssistantAction.Navigate(workAddress)
        }
        if (text.contains("charg") && (text.startsWith("find") || text.contains("nearest") || text.contains("where"))) {
            return AssistantAction.SearchNearby("EV charging station")
        }
        find.find(text)?.let { return AssistantAction.SearchNearby(it.groupValues[1].trim()) }
        navigate.find(text)?.let { m ->
            val dest = m.groupValues[1].trim()
            return when (dest) {
                "home" -> homeAddress.takeIf { it.isNotBlank() }?.let { AssistantAction.Navigate(it) }
                "work" -> workAddress.takeIf { it.isNotBlank() }?.let { AssistantAction.Navigate(it) }
                else -> AssistantAction.Navigate(dest)
            }
        }
        open.find(text)?.let { return AssistantAction.OpenApp(it.groupValues[1].trim()) }
        return null
    }
}

/** What the assistant knows about the moment, sent with each question. */
data class AssistantContext(
    val assistantName: String,
    val ownerName: String,
    val carModel: String,
    val currency: String,
    val moving: Boolean,
    val state: VehicleState,
    val nowPlaying: String?,
    val nextTurn: String?,
    val homeAddress: String,
    val workAddress: String,
    val localTime: String,
)

/**
 * Builds Gemini API requests and reads the replies. HTTP is done by the app;
 * this stays pure so it can be tested without a network or a key.
 * API: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */
object GeminiProtocol {
    const val DEFAULT_MODEL = "gemini-flash-lite-latest"

    fun endpoint(model: String): String =
        "https://generativelanguage.googleapis.com/v1beta/models/${model.trim().ifEmpty { DEFAULT_MODEL }}:generateContent"

    fun systemPrompt(ctx: AssistantContext): String = buildString {
        append("You are ${ctx.assistantName}, the on-board assistant of GenDrive")
        if (ctx.ownerName.isNotBlank()) append(" in ${ctx.ownerName}'s ${ctx.carModel}") else append(" in a ${ctx.carModel}")
        append(". ")
        append("Personality: a calm, refined British butler-engineer with dry, understated wit. Warm but never gushing. ")
        if (ctx.ownerName.isNotBlank()) append("Address the driver as ${ctx.ownerName} now and then. ")
        append("Your words are spoken aloud in the car, so: no lists, no markdown, no emojis, no symbols; say units as words. ")
        if (ctx.moving) {
            append("The car is moving: answer in one short sentence, two at most. ")
        } else {
            append("The car is parked: you may use up to four sentences. ")
        }
        append("Never suggest watching video, reading or typing while driving. ")
        append("Use the car status to answer questions about battery, range, speed, tyres, charging and music. ")
        append("To navigate, search nearby, control music or open an app, call the matching function instead of describing it. ")
        append("Money is in ${ctx.currency}. If you are unsure, say so briefly. ")
        append("You are an original character: if asked, you are not JARVIS or any film AI, though you take the comparison as a compliment.")
    }

    fun carStatus(ctx: AssistantContext): String {
        val s = ctx.state
        val parts = mutableListOf<String>()
        parts += "Local time ${ctx.localTime}."
        parts += if (ctx.moving) "Car is moving" + (s.speedKmh?.let { " at ${it.roundToInt()} km/h" } ?: "") + "." else "Car is parked."
        s.socPercent?.let { parts += "Battery ${it.roundToInt()}%." }
        s.rangeKm?.let { parts += "Range $it km." }
        s.outsideTempC?.let { parts += "Outside ${it.roundToInt()}°C." }
        if (s.isCharging) parts += "Charging at ${String.format(Locale.US, "%.1f", s.chargePowerKw ?: 0.0)} kW."
        s.tyres?.lowest()?.let { parts += "Lowest tyre ${it.roundToInt()} kPa." }
        ctx.nowPlaying?.let { parts += "Now playing: $it." }
        ctx.nextTurn?.let { parts += "Navigation: $it." }
        if (ctx.homeAddress.isNotBlank()) parts += "Home: ${ctx.homeAddress}."
        if (ctx.workAddress.isNotBlank()) parts += "Work: ${ctx.workAddress}."
        return "Car status: " + parts.joinToString(" ")
    }

    private fun stringParam(name: String, description: String) = buildJsonObject {
        put("type", "OBJECT")
        putJsonObject("properties") {
            putJsonObject(name) {
                put("type", "STRING")
                put("description", description)
            }
        }
        putJsonArray("required") { add(JsonPrimitive(name)) }
    }

    val tools: JsonArray = buildJsonArray {
        add(
            buildJsonObject {
                putJsonArray("functionDeclarations") {
                    add(function("navigate_to", "Start Google Maps driving navigation to a place, address or saved place.", stringParam("destination", "Place name or address, e.g. 'SM City General Santos'")))
                    add(function("search_nearby", "Show nearby places on Google Maps, e.g. EV charging, coffee, parking.", stringParam("query", "What to look for")))
                    add(
                        function(
                            "control_media", "Control the music that is playing.",
                            buildJsonObject {
                                put("type", "OBJECT")
                                putJsonObject("properties") {
                                    putJsonObject("action") {
                                        put("type", "STRING")
                                        putJsonArray("enum") { listOf("play", "pause", "next", "previous").forEach { add(JsonPrimitive(it)) } }
                                    }
                                }
                                putJsonArray("required") { add(JsonPrimitive("action")) }
                            },
                        ),
                    )
                    add(function("open_app", "Open an installed app by its name, e.g. Spotify or Waze.", stringParam("app_name", "The app's name")))
                }
            },
        )
    }

    private fun function(name: String, description: String, parameters: JsonObject) = buildJsonObject {
        put("name", name)
        put("description", description)
        put("parameters", parameters)
    }

    /** One request: spoken audio (base64) or typed text, plus the car status. */
    fun request(ctx: AssistantContext, audioBase64: String?, audioMime: String?, text: String?): String {
        val body = buildJsonObject {
            putJsonObject("systemInstruction") {
                putJsonArray("parts") { add(buildJsonObject { put("text", systemPrompt(ctx)) }) }
            }
            putJsonArray("contents") {
                add(
                    buildJsonObject {
                        put("role", "user")
                        putJsonArray("parts") {
                            add(buildJsonObject { put("text", carStatus(ctx)) })
                            if (audioBase64 != null && audioMime != null) {
                                add(buildJsonObject { put("text", "The driver's spoken request follows as audio.") })
                                add(
                                    buildJsonObject {
                                        putJsonObject("inlineData") {
                                            put("mimeType", audioMime)
                                            put("data", audioBase64)
                                        }
                                    },
                                )
                            }
                            if (!text.isNullOrBlank()) add(buildJsonObject { put("text", "The driver says: $text") })
                        }
                    },
                )
            }
            put("tools", tools)
            putJsonObject("generationConfig") {
                put("temperature", 0.6)
                put("maxOutputTokens", 300)
            }
        }
        return body.toString()
    }

    private val json = Json { ignoreUnknownKeys = true }

    /** Turns a generateContent response into speech plus actions, or throws with Google's error text. */
    fun parse(responseBody: String): AssistantReply {
        val root = json.parseToJsonElement(responseBody).jsonObject
        root["error"]?.jsonObject?.let { err ->
            throw IllegalStateException(err["message"]?.jsonPrimitive?.contentOrNull ?: "Gemini error")
        }
        val parts = root["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("content")?.jsonObject?.get("parts")?.jsonArray ?: return AssistantReply(null, emptyList())
        val speech = StringBuilder()
        val actions = mutableListOf<AssistantAction>()
        for (p in parts) {
            val part = p.jsonObject
            if (part["thought"]?.jsonPrimitive?.contentOrNull == "true") continue
            part["text"]?.jsonPrimitive?.contentOrNull?.let { speech.append(it.trim()).append(' ') }
            part["functionCall"]?.jsonObject?.let { call ->
                val args = call["args"]?.jsonObject
                fun arg(k: String) = args?.get(k)?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
                when (call["name"]?.jsonPrimitive?.contentOrNull) {
                    "navigate_to" -> arg("destination").takeIf { it.isNotEmpty() }?.let { actions += AssistantAction.Navigate(it) }
                    "search_nearby" -> arg("query").takeIf { it.isNotEmpty() }?.let { actions += AssistantAction.SearchNearby(it) }
                    "control_media" -> arg("action").takeIf { it.isNotEmpty() }?.let { actions += AssistantAction.Media(it) }
                    "open_app" -> arg("app_name").takeIf { it.isNotEmpty() }?.let { actions += AssistantAction.OpenApp(it) }
                }
            }
        }
        return AssistantReply(speech.toString().trim().ifEmpty { null }?.let(::forSpeech), actions)
    }

    /** Removes markdown and symbols a model sometimes adds anyway. */
    fun forSpeech(text: String): String = text
        .replace(Regex("""[*_#`>]+"""), "")
        .replace(Regex("""\s+"""), " ")
        .trim()
}
