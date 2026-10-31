package com.genestjanramirez.gendrive.media

import android.content.Context
import com.genestjanramirez.gendrive.BuildConfig
import com.genestjanramirez.gendrive.core.lyrics.HttpGetter
import com.genestjanramirez.gendrive.core.lyrics.HttpResponse
import com.genestjanramirez.gendrive.core.lyrics.LrclibClient
import com.genestjanramirez.gendrive.core.lyrics.LrclibTrack
import com.genestjanramirez.gendrive.core.lyrics.Lyrics
import com.genestjanramirez.gendrive.core.lyrics.LyricsResult
import com.genestjanramirez.gendrive.core.lyrics.TrackQuery
import com.genestjanramirez.gendrive.data.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

sealed interface LyricsState {
    data object Off : LyricsState
    data object Idle : LyricsState
    data class Loading(val key: String) : LyricsState
    data class Ready(val key: String, val lyrics: Lyrics) : LyricsState
    data class Instrumental(val key: String) : LyricsState
    data class Missing(val key: String) : LyricsState
    data class Error(val key: String, val message: String) : LyricsState
}

/**
 * Fetches synced lyrics for whatever is playing from LRCLIB (free, no key).
 * Found lyrics are cached on disk, so a song heard before shows lyrics offline.
 */
class LyricsRepository(
    context: Context,
    scope: CoroutineScope,
    media: MediaRepository,
    settings: SettingsStore,
) {
    private val client = LrclibClient(
        http = HttpGetter { url, headers -> get(url, headers) },
        userAgent = "GenDrive/${BuildConfig.VERSION_NAME} (https://github.com/genestjan/genestjan)",
    )
    private val json = Json { ignoreUnknownKeys = true }
    private val diskDir = File(context.cacheDir, "lyrics").apply { mkdirs() }
    private val memory = object : LinkedHashMap<String, LyricsResult>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, LyricsResult>?): Boolean = size > 60
    }

    private val _state = MutableStateFlow<LyricsState>(LyricsState.Idle)
    val state: StateFlow<LyricsState> = _state.asStateFlow()

    init {
        scope.launch {
            combine(media.nowPlaying, settings.state) { np, s -> Pair(np, s.lyricsEnabled) }
                .distinctUntilChanged { a, b -> a.first?.trackKey == b.first?.trackKey && a.second == b.second }
                .collectLatest { (np, enabled) ->
                    when {
                        !enabled -> _state.value = LyricsState.Off
                        np == null || np.title.isBlank() -> _state.value = LyricsState.Idle
                        else -> {
                            val key = np.trackKey
                            _state.value = LyricsState.Loading(key)
                            _state.value = when (val r = load(np)) {
                                is LyricsResult.Found -> LyricsState.Ready(key, r.lyrics)
                                LyricsResult.Instrumental -> LyricsState.Instrumental(key)
                                LyricsResult.NotFound -> LyricsState.Missing(key)
                                is LyricsResult.Failed -> LyricsState.Error(key, r.reason)
                            }
                        }
                    }
                }
        }
    }

    private suspend fun load(np: NowPlaying): LyricsResult = withContext(Dispatchers.IO) {
        val key = np.trackKey
        synchronized(memory) { memory[key] }?.let { return@withContext it }
        readDisk(key)?.let { cached ->
            val r = LrclibClient.toResult(cached)
            synchronized(memory) { memory[key] = r }
            return@withContext r
        }
        val durationSec = (np.durationMs / 1000).toInt().takeIf { it > 0 }
        val result = client.fetch(TrackQuery(np.title, np.artist, np.album, durationSec))
        if (result !is LyricsResult.Failed) synchronized(memory) { memory[key] = result }
        if (result is LyricsResult.Found) writeDisk(key, result.track)
        result
    }

    private fun fileFor(key: String): File {
        val digest = MessageDigest.getInstance("SHA-1").digest(key.toByteArray())
        return File(diskDir, digest.joinToString("") { "%02x".format(it) } + ".json")
    }

    private fun readDisk(key: String): LrclibTrack? = try {
        val f = fileFor(key)
        if (f.exists()) json.decodeFromString(LrclibTrack.serializer(), f.readText()) else null
    } catch (e: Exception) {
        null
    }

    private fun writeDisk(key: String, track: LrclibTrack) {
        try {
            fileFor(key).writeText(json.encodeToString(LrclibTrack.serializer(), track))
        } catch (e: Exception) {
            // A full cache is not worth bothering the driver about.
        }
    }

    private fun get(url: String, headers: Map<String, String>): HttpResponse {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 8_000
        c.readTimeout = 8_000
        headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
        try {
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            return HttpResponse(code, body)
        } finally {
            c.disconnect()
        }
    }
}
