package com.genestjanramirez.gendrive.core

import com.genestjanramirez.gendrive.core.lyrics.HttpGetter
import com.genestjanramirez.gendrive.core.lyrics.HttpResponse
import com.genestjanramirez.gendrive.core.lyrics.LrcParser
import com.genestjanramirez.gendrive.core.lyrics.LrclibClient
import com.genestjanramirez.gendrive.core.lyrics.LrclibTrack
import com.genestjanramirez.gendrive.core.lyrics.LyricsResult
import com.genestjanramirez.gendrive.core.lyrics.TitleCleaner
import com.genestjanramirez.gendrive.core.lyrics.TrackQuery
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LyricsTest {

    @Test
    fun parsesStampsMetadataAndRepeatedLines() {
        val lrc = """
            [ar:Coldplay]
            [ti:Yellow]
            [00:33.50] Look at the stars
            [00:37.2] Look how they shine for you
            [01:10.00][02:20.00] And it was all yellow
            [03:00.00]
        """.trimIndent()
        val lyrics = LrcParser.parseSynced(lrc)
        assertTrue(lyrics.synced)
        assertEquals(5, lyrics.lines.size)
        assertEquals(33_500, lyrics.lines[0].timeMs)
        assertEquals(37_200, lyrics.lines[1].timeMs)
        assertEquals("And it was all yellow", lyrics.lines[2].text)
        assertEquals(140_000, lyrics.lines[3].timeMs)
        assertEquals("", lyrics.lines[4].text)
    }

    @Test
    fun appliesOffsetTag() {
        val lyrics = LrcParser.parseSynced("[offset:+500]\n[00:10.00] Line")
        assertEquals(9_500, lyrics.lines.single().timeMs)
    }

    @Test
    fun findsCurrentLineByPosition() {
        val lyrics = LrcParser.parseSynced("[00:05.00] a\n[00:10.00] b\n[00:15.00] c")
        assertEquals(-1, lyrics.indexAt(4_999))
        assertEquals(0, lyrics.indexAt(5_000))
        assertEquals(1, lyrics.indexAt(14_999))
        assertEquals(2, lyrics.indexAt(600_000))
    }

    @Test
    fun cleansTitlesAndArtists() {
        assertEquals("Yesterday", TitleCleaner.clean("Yesterday - Remastered 2009"))
        assertEquals("Stay", TitleCleaner.clean("Stay (feat. Justin Bieber)"))
        assertEquals("Song", TitleCleaner.clean("Song [Official Video]"))
        assertEquals("Ben&Ben", TitleCleaner.mainArtist("Ben&Ben"))
        assertEquals("The Kid LAROI", TitleCleaner.mainArtist("The Kid LAROI, Justin Bieber"))
        assertEquals("Lil Nas X", TitleCleaner.mainArtist("Lil Nas X"))
    }

    @Test
    fun buildsEncodedUrls() {
        val client = LrclibClient({ _, _ -> HttpResponse(404, "") }, "test")
        val url = client.getUrl(TrackQuery("Mundo", "IV of Spades", album = "ClapClapClap!", durationSec = 291))
        assertEquals(
            "https://lrclib.net/api/get?track_name=Mundo&artist_name=IV%20of%20Spades&album_name=ClapClapClap%21&duration=291",
            url,
        )
    }

    @Test
    fun fallsBackToSearchAndPicksMatchingDuration() {
        val calls = mutableListOf<String>()
        val http = HttpGetter { url, headers ->
            calls += url
            assertEquals("GenDrive-test", headers["User-Agent"])
            if (url.contains("/api/get")) {
                HttpResponse(404, """{"code":404,"name":"TrackNotFound"}""")
            } else {
                HttpResponse(
                    200,
                    """[
                      {"id":1,"trackName":"Yellow","artistName":"Coldplay","duration":400.0,"instrumental":false,"plainLyrics":"x","syncedLyrics":"[00:01.00] live"},
                      {"id":2,"trackName":"Yellow","artistName":"Coldplay","duration":266.0,"instrumental":false,"plainLyrics":"x","syncedLyrics":"[00:01.00] studio","extraField":true}
                    ]""",
                )
            }
        }
        val result = LrclibClient(http, "GenDrive-test").fetch(TrackQuery("Yellow - Remastered", "Coldplay", durationSec = 267))
        val found = assertIs<LyricsResult.Found>(result)
        assertEquals(2L, found.track.id)
        assertEquals("studio", found.lyrics.lines.single().text)
        assertEquals(3, calls.size) // exact, cleaned exact, search
    }

    @Test
    fun reportsInstrumentalAndHttpErrors() {
        val instrumental = LrclibClient.toResult(LrclibTrack(instrumental = true))
        assertEquals(LyricsResult.Instrumental, instrumental)
        val failing = LrclibClient({ _, _ -> HttpResponse(500, "boom") }, "t").fetch(TrackQuery("a", "b"))
        assertIs<LyricsResult.Failed>(failing)
    }

    @Test
    fun ignoresResultsOfTheWrongLength() {
        val best = LrclibClient.pickBest(listOf(LrclibTrack(id = 1, duration = 100.0, plainLyrics = "x")), durationSec = 200)
        assertNull(best)
    }
}
