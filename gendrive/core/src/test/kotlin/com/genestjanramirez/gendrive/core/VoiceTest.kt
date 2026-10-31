package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.trip.ChargeSession
import com.genestjanramirez.gendrive.core.trip.CostSettings
import com.genestjanramirez.gendrive.core.trip.Trip
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.TyrePressures
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import com.genestjanramirez.gendrive.core.voice.AssistantAction
import com.genestjanramirez.gendrive.core.voice.AssistantContext
import com.genestjanramirez.gendrive.core.voice.GeminiProtocol
import com.genestjanramirez.gendrive.core.voice.LocalCommands
import com.genestjanramirez.gendrive.core.voice.Persona
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class VoiceTest {
    private val car = VehicleState(
        source = DataSource.BYD, timestampMs = 0, speedKmh = 0.0, gear = Gear.P,
        socPercent = 78.4, rangeKm = 380, outsideTempC = 31.6,
        tyres = TyrePressures(248.0, 250.0, 244.0, 251.0),
    )

    @Test
    fun greetsByNameWithBatteryAndNoSymbols() {
        val line = Persona("Jan", random = Random(1)).greeting(19, car)
        assertTrue(line.contains("Jan"), line)
        assertTrue(line.contains("78 percent"), line)
        assertTrue(line.contains("380 kilometres"), line)
        assertFalse(line.contains("%") || line.contains("km"), line)
    }

    @Test
    fun summarisesATripWithMoneyAsWords() {
        val trip = Trip("t", 0, 3_600_000, distanceKm = 68.0, energyKwh = 8.5)
        val line = Persona("Jan", random = Random(2)).tripSummary(trip, CostSettings())
        assertTrue(line.contains("68 kilometres"), line)
        assertTrue(line.contains("pesos"), line)
        assertTrue(line.contains("less than petrol"), line)
        assertFalse(line.contains("₱"), line)
    }

    @Test
    fun spokenSummariesUseMoneyNotKilowattHours() {
        // The demo trip from the videos: 18.4 km at 12.1 kWh/100 km with the default Philippine prices.
        val trip = Trip("t", 0, 1_800_000, distanceKm = 18.4, energyKwh = 18.4 * 12.1 / 100)
        val line = Persona("Jan", random = Random(0)).tripSummary(trip, CostSettings())
        assertTrue(line.contains("18 kilometres for about 30 pesos."), line)
        assertTrue(line.contains("That's 59 pesos less than petrol."), line)
        assertFalse(line.contains("kilowatt"), line)

        val charge = ChargeSession("c", 0, 3_600_000, startSoc = 40.0, endSoc = 92.0, energyKwh = 28.8, maxPowerKw = 7.0)
        val charged = Persona("Jan").chargingComplete(charge, CostSettings())
        assertEquals("Charging finished. Battery at 92 percent. That top-up cost about 384 pesos.", charged)
    }

    @Test
    fun namesHomeAndWorkInsteadOfReadingAddresses() {
        val home = "Lagao, GenSan"
        val work = "KCC Mall"
        repeat(6) { seed ->
            val p = Persona("Jan", random = Random(seed))
            val toHome = p.navigating("lagao, gensan ", homeAddress = home, workAddress = work)
            assertTrue(toHome.contains("home", ignoreCase = true) && !toHome.contains("Lagao"), toHome)
            val toWork = p.navigating(work, homeAddress = home, workAddress = work)
            assertTrue(toWork.contains("work") && !toWork.contains("KCC"), toWork)
            assertTrue(p.navigating("SM City GenSan", homeAddress = home, workAddress = work).contains("SM City GenSan"))
        }
        assertTrue(Persona("Jan").navigating(home).contains(home), "no saved home: read the place out")
    }

    @Test
    fun partOfDayMatchesTheClock() {
        assertEquals("Good morning", Persona.partOfDay(7))
        assertEquals("Good afternoon", Persona.partOfDay(13))
        assertEquals("Good evening", Persona.partOfDay(19))
        assertEquals("Good evening", Persona.partOfDay(2))
    }

    @Test
    fun speaksMoney() {
        assertEquals("152 pesos", Persona.money(151.6, "₱"))
        assertEquals("40 baht", Persona.money(40.0, "฿"))
    }

    @Test
    fun understandsBasicCommandsOffline() {
        val home = "Robinsons Place GenSan"
        assertEquals(AssistantAction.Navigate(home), LocalCommands.parse("Take me home.", home, ""))
        assertEquals(AssistantAction.Navigate("kcc mall"), LocalCommands.parse("navigate to KCC Mall", home, ""))
        assertEquals(AssistantAction.SearchNearby("EV charging station"), LocalCommands.parse("find a charging station", home, ""))
        assertEquals(AssistantAction.SearchNearby("coffee"), LocalCommands.parse("find coffee nearby", home, ""))
        assertEquals(AssistantAction.Media("next"), LocalCommands.parse("Next song", home, ""))
        assertEquals(AssistantAction.Media("pause"), LocalCommands.parse("pause", home, ""))
        assertEquals(AssistantAction.OpenApp("spotify"), LocalCommands.parse("open Spotify", home, ""))
        assertEquals(AssistantAction.Status, LocalCommands.parse("battery status", home, ""))
        assertEquals(AssistantAction.Status, LocalCommands.parse("How's the battery?", home, ""))
        assertNull(LocalCommands.parse("go to work", home, "")) // no work address saved
        assertNull(LocalCommands.parse("what is the meaning of life", home, ""))
    }

    private fun ctx(moving: Boolean) = AssistantContext(
        assistantName = "Gen", ownerName = "Jan", carModel = "eMAX 7", currency = "₱", moving = moving,
        state = car, nowPlaying = "Mundo by IV of Spades", nextTurn = null,
        homeAddress = "Home St", workAddress = "", localTime = "19:05",
    )

    @Test
    fun buildsAGeminiRequestWithAudioToolsAndPersona() {
        val body = GeminiProtocol.request(ctx(moving = true), audioBase64 = "QUJD", audioMime = "audio/aac", text = null)
        val root = Json.parseToJsonElement(body).jsonObject
        val system = root["systemInstruction"].toString()
        assertTrue(system.contains("British"), system)
        assertTrue(system.contains("one short sentence"), system)
        val parts = root["contents"]!!.jsonArray[0].jsonObject["parts"]!!.jsonArray
        assertTrue(parts.toString().contains("Battery 78%"))
        assertTrue(parts.toString().contains("\"mimeType\":\"audio/aac\""))
        val functions = root["tools"]!!.jsonArray[0].jsonObject["functionDeclarations"]!!.jsonArray
        assertEquals(4, functions.size)
        assertTrue(GeminiProtocol.endpoint("").endsWith("/models/gemini-flash-lite-latest:generateContent"))
    }

    @Test
    fun readsTextAndFunctionCallsFromGemini() {
        val response = """
            {"candidates":[{"content":{"role":"model","parts":[
              {"text":"Right away, **Jan**."},
              {"functionCall":{"name":"navigate_to","args":{"destination":"SM City General Santos"}}},
              {"functionCall":{"name":"control_media","args":{"action":"pause"}}}
            ]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":42}}
        """.trimIndent()
        val reply = GeminiProtocol.parse(response)
        assertEquals("Right away, Jan.", reply.speech)
        assertEquals(
            listOf(AssistantAction.Navigate("SM City General Santos"), AssistantAction.Media("pause")),
            reply.actions,
        )
    }

    @Test
    fun surfacesGeminiErrors() {
        val error = """{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}"""
        val e = assertFailsWith<IllegalStateException> { GeminiProtocol.parse(error) }
        assertTrue(e.message!!.contains("API key not valid"))
    }
}
