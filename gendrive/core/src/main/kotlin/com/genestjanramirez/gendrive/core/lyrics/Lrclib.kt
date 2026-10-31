package com.genestjanramirez.gendrive.core.lyrics

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.net.URLEncoder
import kotlin.math.abs

/** A track as returned by LRCLIB (https://lrclib.net), a free lyrics database with no API key. */
@Serializable
data class LrclibTrack(
    val id: Long? = null,
    val trackName: String? = null,
    val artistName: String? = null,
    val albumName: String? = null,
    val duration: Double? = null,
    val instrumental: Boolean = false,
    val plainLyrics: String? = null,
    val syncedLyrics: String? = null,
)

data class TrackQuery(
    val title: String,
    val artist: String,
    val album: String? = null,
    val durationSec: Int? = null,
)

data class HttpResponse(val code: Int, val body: String)

/** Injected so the client is testable without a network. */
fun interface HttpGetter {
    fun get(url: String, headers: Map<String, String>): HttpResponse
}

sealed interface LyricsResult {
    data class Found(val lyrics: Lyrics, val track: LrclibTrack) : LyricsResult
    data object Instrumental : LyricsResult
    data object NotFound : LyricsResult
    data class Failed(val reason: String) : LyricsResult
}

/**
 * Looks up lyrics in up to three steps, stopping at the first hit:
 *  1. exact match on the title and artist as the music app reports them
 *  2. exact match on a cleaned title and the first artist
 *  3. search, picking the result whose length matches the song
 */
class LrclibClient(
    private val http: HttpGetter,
    private val userAgent: String,
    private val baseUrl: String = "https://lrclib.net",
) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = false
    }

    fun getUrl(q: TrackQuery): String = buildString {
        append(baseUrl).append("/api/get?track_name=").append(enc(q.title))
        append("&artist_name=").append(enc(q.artist))
        q.album?.takeIf { it.isNotBlank() }?.let { append("&album_name=").append(enc(it)) }
        q.durationSec?.takeIf { it > 0 }?.let { append("&duration=").append(it) }
    }

    fun searchUrl(q: TrackQuery): String =
        "$baseUrl/api/search?track_name=${enc(q.title)}&artist_name=${enc(q.artist)}"

    fun fetch(query: TrackQuery): LyricsResult {
        if (query.title.isBlank()) return LyricsResult.NotFound
        return try {
            val first = getExact(query)
            if (first != null) return first
            val cleaned = query.copy(
                title = TitleCleaner.clean(query.title),
                artist = TitleCleaner.mainArtist(query.artist),
                album = null,
            )
            if (cleaned.title != query.title || cleaned.artist != query.artist) {
                val second = getExact(cleaned)
                if (second != null) return second
            }
            search(cleaned)
        } catch (e: Exception) {
            LyricsResult.Failed(e.message ?: e.javaClass.simpleName)
        }
    }

    /** Returns null when LRCLIB has no exact match (HTTP 404). */
    private fun getExact(q: TrackQuery): LyricsResult? {
        val r = http.get(getUrl(q), headers())
        return when (r.code) {
            200 -> toResult(json.decodeFromString(LrclibTrack.serializer(), r.body))
            404 -> null
            else -> throw IllegalStateException("LRCLIB answered HTTP ${r.code}")
        }
    }

    private fun search(q: TrackQuery): LyricsResult {
        val r = http.get(searchUrl(q), headers())
        if (r.code == 404) return LyricsResult.NotFound
        if (r.code != 200) return LyricsResult.Failed("LRCLIB answered HTTP ${r.code}")
        val list = json.decodeFromString(ListSerializer(LrclibTrack.serializer()), r.body)
        val best = pickBest(list, q.durationSec) ?: return LyricsResult.NotFound
        return toResult(best)
    }

    private fun headers() = mapOf("User-Agent" to userAgent, "Accept" to "application/json")

    companion object {
        /** Songs whose length differs by more than this are a different recording. */
        const val DURATION_TOLERANCE_SEC = 3.0

        fun toResult(track: LrclibTrack): LyricsResult {
            if (track.instrumental) return LyricsResult.Instrumental
            val synced = track.syncedLyrics?.takeIf { it.isNotBlank() }?.let { LrcParser.parseSynced(it) }
            if (synced != null && !synced.isEmpty) return LyricsResult.Found(synced, track)
            val plain = track.plainLyrics?.takeIf { it.isNotBlank() }?.let { LrcParser.parsePlain(it) }
            if (plain != null && !plain.isEmpty) return LyricsResult.Found(plain, track)
            return LyricsResult.NotFound
        }

        fun pickBest(list: List<LrclibTrack>, durationSec: Int?): LrclibTrack? {
            val usable = list.filter {
                it.instrumental || !it.syncedLyrics.isNullOrBlank() || !it.plainLyrics.isNullOrBlank()
            }
            if (usable.isEmpty()) return null
            val pool = if (durationSec == null) {
                usable
            } else {
                usable.filter { it.duration == null || abs(it.duration - durationSec) <= DURATION_TOLERANCE_SEC }
            }
            if (pool.isEmpty()) return null
            return pool.sortedWith(
                compareByDescending<LrclibTrack> { !it.syncedLyrics.isNullOrBlank() }
                    .thenBy { t -> if (durationSec == null || t.duration == null) 0.0 else abs(t.duration - durationSec) },
            ).first()
        }

        fun enc(s: String): String = URLEncoder.encode(s.trim(), "UTF-8").replace("+", "%20")
    }
}
