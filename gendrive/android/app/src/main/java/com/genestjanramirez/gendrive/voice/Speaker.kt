package com.genestjanramirez.gendrive.voice

import android.content.Context
import android.media.AudioAttributes
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.UUID

data class VoiceOption(val id: String, val label: String, val needsNetwork: Boolean)

/**
 * Gen's voice: the car's own text-to-speech engine, tuned towards a calm British
 * male delivery (slightly lower pitch, slightly slower). Which voices exist depends
 * on the TTS engine installed on the head unit; the owner can pick any of them.
 */
class Speaker(context: Context) {
    private val _ready = MutableStateFlow(false)
    val ready: StateFlow<Boolean> = _ready.asStateFlow()

    private val _speaking = MutableStateFlow(false)
    val speaking: StateFlow<Boolean> = _speaking.asStateFlow()

    private val _voices = MutableStateFlow<List<VoiceOption>>(emptyList())
    val voices: StateFlow<List<VoiceOption>> = _voices.asStateFlow()

    private var preferredVoiceId: String = ""
    private var tts: TextToSpeech? = null

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.let { engine ->
                    engine.setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build(),
                    )
                    engine.setPitch(0.92f)
                    engine.setSpeechRate(0.96f)
                    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            _speaking.value = true
                        }

                        override fun onDone(utteranceId: String?) {
                            _speaking.value = false
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            _speaking.value = false
                        }
                    })
                    _voices.value = englishVoices(engine)
                    applyVoice(engine)
                    _ready.value = true
                }
            }
        }
    }

    fun setPreferredVoice(id: String) {
        preferredVoiceId = id
        tts?.let { if (_ready.value) applyVoice(it) }
    }

    fun speak(text: String, interrupt: Boolean = true) {
        val engine = tts ?: return
        if (!_ready.value || text.isBlank()) return
        engine.speak(text, if (interrupt) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, UUID.randomUUID().toString())
    }

    fun stop() {
        tts?.stop()
        _speaking.value = false
    }

    private fun englishVoices(engine: TextToSpeech): List<VoiceOption> = try {
        engine.voices.orEmpty()
            .filter { it.locale.language == "en" }
            .sortedWith(compareByDescending<Voice> { score(it) }.thenBy { it.name })
            .map { VoiceOption(it.name, describe(it), it.isNetworkConnectionRequired) }
    } catch (e: Exception) {
        emptyList()
    }

    private fun applyVoice(engine: TextToSpeech) {
        try {
            val all = engine.voices.orEmpty()
            val chosen = all.firstOrNull { it.name == preferredVoiceId }
                ?: all.filter { it.locale.language == "en" }.maxByOrNull { score(it) }
            if (chosen != null) {
                engine.setVoice(chosen)
            } else {
                engine.setLanguage(Locale.UK)
            }
        } catch (e: Exception) {
            engine.setLanguage(Locale.UK)
        }
    }

    /** British, offline, male-sounding voices first. Voice gender is not exposed by Android, so names are a hint. */
    private fun score(v: Voice): Int {
        var s = 0
        if (v.locale.country.equals("GB", ignoreCase = true)) s += 100
        if (!v.isNetworkConnectionRequired) s += 20
        val n = v.name.lowercase(Locale.ROOT)
        if ("male" in n && "female" !in n) s += 30
        if (listOf("gbd", "rjs", "gbb-local").any { it in n }) s += 25
        if (v.quality >= Voice.QUALITY_HIGH) s += 10
        return s
    }

    private fun describe(v: Voice): String {
        val country = v.locale.displayCountry.ifBlank { v.locale.country }
        val net = if (v.isNetworkConnectionRequired) ", online" else ""
        return "English ($country) · ${v.name}$net"
    }

    fun shutdown() {
        tts?.shutdown()
        tts = null
    }
}
