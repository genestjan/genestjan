package com.genestjanramirez.gendrive.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.format.DateFormat
import android.util.Base64
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.drive.Motion
import com.genestjanramirez.gendrive.core.trip.ChargeSession
import com.genestjanramirez.gendrive.core.trip.Trip
import com.genestjanramirez.gendrive.core.voice.AssistantAction
import com.genestjanramirez.gendrive.core.voice.AssistantContext
import com.genestjanramirez.gendrive.core.voice.AssistantReply
import com.genestjanramirez.gendrive.core.voice.GeminiProtocol
import com.genestjanramirez.gendrive.core.voice.LocalCommands
import com.genestjanramirez.gendrive.core.voice.Persona
import com.genestjanramirez.gendrive.nav.MapsLauncher
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.Date
import kotlin.coroutines.resume

enum class AssistantPhase { IDLE, LISTENING, THINKING, SPEAKING }

data class AssistantUi(
    val phase: AssistantPhase = AssistantPhase.IDLE,
    val level: Float = 0f,
    val heard: String? = null,
    val reply: String? = null,
)

/**
 * Gen, GenDrive's voice. Greets the driver, reports status, sums up trips, warns
 * about low battery or tyres, and answers spoken requests:
 *  1. with the owner's Gemini key: audio goes to Gemini, which can call functions
 *  2. without a key: the head unit's own speech recogniser plus offline commands
 */
class VoiceAssistant(private val context: Context, private val graph: AppGraph) {
    val speaker = Speaker(context)
    private val recorder = VoiceRecorder(context)
    private val main = Handler(Looper.getMainLooper())
    private val prefs = context.getSharedPreferences("gendrive_voice", Context.MODE_PRIVATE)

    private val _ui = MutableStateFlow(AssistantUi())
    val ui: StateFlow<AssistantUi> = _ui.asStateFlow()

    private var turn: Job? = null
    private var warnedLowBattery = false
    private var warnedTyres = false

    init {
        speaker.setPreferredVoice(graph.settings.current.voiceId)
        graph.scope.launch {
            graph.settings.state.collect { speaker.setPreferredVoice(it.voiceId) }
        }
        graph.scope.launch {
            speaker.speaking.collect { speaking ->
                _ui.update {
                    when {
                        speaking -> it.copy(phase = AssistantPhase.SPEAKING)
                        it.phase == AssistantPhase.SPEAKING -> it.copy(phase = AssistantPhase.IDLE)
                        else -> it
                    }
                }
            }
        }
        graph.scope.launch {
            graph.trips.events.collect { event ->
                val s = graph.settings.current
                if (!s.spokenTripSummaries) return@collect
                when (event) {
                    is Trip -> say(persona().tripSummary(event, s.cost))
                    is ChargeSession -> say(persona().chargingComplete(event, s.cost))
                }
            }
        }
    }

    private fun persona(): Persona = with(graph.settings.current) { Persona(ownerName, distanceUnit, pressureUnit) }

    fun say(text: String, interrupt: Boolean = true) {
        _ui.update { it.copy(reply = text) }
        speaker.speak(text, interrupt)
    }

    /** Spoken welcome when the car starts, at most once every two hours. */
    fun greetIfDue() {
        val s = graph.settings.current
        if (!s.spokenGreeting) return
        val last = prefs.getLong("lastGreeting", 0L)
        if (System.currentTimeMillis() - last < 2 * 3_600_000L) return
        graph.scope.launch {
            withTimeoutOrNull(8_000) { speaker.ready.first { it } } ?: return@launch
            withTimeoutOrNull(6_000) { graph.vehicle.state.first { it.hasLiveData && it.socPercent != null } }
            prefs.edit().putLong("lastGreeting", System.currentTimeMillis()).apply()
            val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
            say(persona().greeting(hour, graph.vehicle.state.value))
        }
    }

    /** Called about once a second by the drive service. Speaks each warning once. */
    fun checkWarnings() {
        val s = graph.settings.current
        val state = graph.vehicle.state.value
        if (!s.spokenWarnings || !state.hasLiveData) return
        val soc = state.socPercent
        if (soc != null) {
            if (soc < 15.0 && !warnedLowBattery && !state.isCharging) {
                warnedLowBattery = true
                say(persona().lowBattery(state), interrupt = false)
            } else if (soc > 20.0) {
                warnedLowBattery = false
            }
        }
        val lowest = state.tyres?.lowest()
        if (lowest != null) {
            if (lowest < s.lowTyreKpa && !warnedTyres) {
                warnedTyres = true
                say(persona().lowTyre(lowest), interrupt = false)
            } else if (lowest > s.lowTyreKpa + 10) {
                warnedTyres = false
            }
        }
    }

    /** The mic button: tap to talk, tap again to cancel. */
    fun toggleListening() {
        if (turn?.isActive == true) {
            turn?.cancel()
            _ui.value = AssistantUi()
            return
        }
        speaker.stop()
        turn = graph.scope.launch {
            try {
                runTurn()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                say("Something went wrong: ${e.message ?: "unknown error"}.")
            }
        }
    }

    private suspend fun runTurn() {
        val s = graph.settings.current
        val p = persona()
        _ui.value = AssistantUi(phase = AssistantPhase.LISTENING)
        if (s.geminiApiKey.isNotBlank()) {
            val audio = recorder.record(onLevel = { level -> _ui.update { it.copy(level = level) } })
            if (audio == null) {
                say(p.didNotCatch())
                return
            }
            _ui.update { it.copy(phase = AssistantPhase.THINKING, level = 0f, heard = "…") }
            val reply = try {
                askGemini(audio, s.geminiApiKey.trim(), s.geminiModel.trim())
            } catch (e: IOException) {
                say(p.offline())
                return
            } catch (e: IllegalStateException) {
                say("Gemini says: ${e.message}")
                return
            }
            act(reply, p)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            say(p.needsGeminiKey())
            return
        }
        val heard = transcribeOnDevice()
        if (heard.isNullOrBlank()) {
            say(p.didNotCatch())
            return
        }
        _ui.update { it.copy(phase = AssistantPhase.THINKING, heard = heard, level = 0f) }
        val action = LocalCommands.parse(heard, s.homeAddress, s.workAddress)
        if (action == null) {
            say(p.needsGeminiKey())
            return
        }
        act(AssistantReply(null, listOf(action)), p)
    }

    private fun act(reply: AssistantReply, p: Persona) {
        val confirmations = reply.actions.map { perform(it, p) }
        val speech = reply.speech ?: confirmations.joinToString(" ").ifBlank { p.didNotCatch() }
        say(speech)
    }

    private fun perform(action: AssistantAction, p: Persona): String = when (action) {
        is AssistantAction.Navigate -> {
            MapsLauncher.navigate(context, action.destination)
            p.navigating(action.destination)
        }
        is AssistantAction.SearchNearby -> {
            MapsLauncher.search(context, action.query)
            p.searching(action.query)
        }
        is AssistantAction.Media -> {
            val playing = graph.media.nowPlaying.value?.isPlaying == true
            when (action.action) {
                "play" -> if (!playing) graph.media.play()
                "pause" -> if (playing) graph.media.pause()
                "next" -> graph.media.next()
                "previous" -> graph.media.previous()
            }
            p.media(action.action)
        }
        is AssistantAction.OpenApp -> {
            val app = graph.apps.findByName(action.appName)
            if (app != null && graph.apps.launch(app.packageName)) p.openingApp(app.label) else p.appNotFound(action.appName)
        }
        AssistantAction.Status -> p.statusReport(graph.vehicle.state.value)
    }

    private fun assistantContext(): AssistantContext {
        val s = graph.settings.current
        val np = graph.media.nowPlaying.value
        val nav = graph.nav.live.value?.instruction
        return AssistantContext(
            assistantName = s.assistantName.ifBlank { "Gen" },
            ownerName = s.ownerName,
            carModel = s.carModel.substringBefore(" (").ifBlank { "BYD" },
            currency = s.cost.currency,
            moving = graph.vehicle.motion.value == Motion.MOVING,
            state = graph.vehicle.state.value,
            nowPlaying = np?.takeIf { it.title.isNotBlank() }?.let { "${it.title} by ${it.artist}" },
            nextTurn = nav?.let { listOfNotNull(it.distanceText, it.instruction).joinToString(": ") },
            homeAddress = s.homeAddress,
            workAddress = s.workAddress,
            localTime = DateFormat.getTimeFormat(context).format(Date()),
        )
    }

    private suspend fun askGemini(audio: File, key: String, model: String): AssistantReply = withContext(Dispatchers.IO) {
        val body = GeminiProtocol.request(
            assistantContext(),
            audioBase64 = Base64.encodeToString(audio.readBytes(), Base64.NO_WRAP),
            audioMime = "audio/aac",
            text = null,
        )
        val conn = URL(GeminiProtocol.endpoint(model)).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 10_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("x-goog-api-key", key.trim())
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (text.isBlank()) throw IllegalStateException("empty answer (HTTP $code)")
            GeminiProtocol.parse(text)
        } finally {
            conn.disconnect()
        }
    }

    /** The head unit's own speech recogniser, if it has one. Must run on the main thread. */
    private suspend fun transcribeOnDevice(): String? = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { cont ->
            val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer.setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    recognizer.destroy()
                    if (cont.isActive) cont.resume(text)
                }

                override fun onError(error: Int) {
                    recognizer.destroy()
                    if (cont.isActive) cont.resume(null)
                }

                override fun onRmsChanged(rmsdB: Float) {
                    _ui.update { it.copy(level = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)) }
                }

                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onPartialResults(partialResults: Bundle?) = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            recognizer.startListening(intent)
            cont.invokeOnCancellation {
                main.post {
                    recognizer.cancel()
                    recognizer.destroy()
                }
            }
        }
    }

    /** Lets the Settings screen play a sample line in the chosen voice. */
    fun preview() {
        val s = graph.settings.current
        val who = if (s.ownerName.isNotBlank()) ", ${s.ownerName}" else ""
        say("Good day$who. I'm ${s.assistantName.ifBlank { "Gen" }}. Shall we go for a drive?")
    }
}
