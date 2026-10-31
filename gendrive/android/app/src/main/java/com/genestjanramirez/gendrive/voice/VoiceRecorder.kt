package com.genestjanramirez.gendrive.voice

import android.content.Context
import android.media.MediaRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Records one spoken request as AAC (small, and a format Gemini accepts directly).
 * Stops by itself after the driver stops talking, or after [maxMs].
 */
class VoiceRecorder(private val context: Context) {

    suspend fun record(maxMs: Long = 8_000L, onLevel: (Float) -> Unit = {}): File? = withContext(Dispatchers.IO) {
        val file = File(context.cacheDir, "voice-request.aac")
        @Suppress("DEPRECATION")
        val recorder = MediaRecorder()
        try {
            recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioChannels(1)
            recorder.setAudioSamplingRate(16_000)
            recorder.setAudioEncodingBitRate(32_000)
            recorder.setOutputFile(file.absolutePath)
            recorder.prepare()
            recorder.start()

            val started = System.currentTimeMillis()
            var heardSpeech = false
            var quietSince = 0L
            while (true) {
                delay(100)
                val now = System.currentTimeMillis()
                val level = recorder.maxAmplitude / 32767f
                onLevel(level)
                if (level > 0.08f) {
                    heardSpeech = true
                    quietSince = 0L
                } else if (heardSpeech) {
                    if (quietSince == 0L) quietSince = now
                    if (now - quietSince > 1_200) break
                }
                if (now - started > maxMs) break
                if (!heardSpeech && now - started > 5_000) break
            }
            recorder.stop()
            if (heardSpeech && file.length() > 1_000) file else null
        } catch (e: Exception) {
            null
        } finally {
            recorder.release()
            onLevel(0f)
        }
    }
}
