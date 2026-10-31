package com.genestjanramirez.gendrive.core.lyrics

/** One lyric line. [timeMs] is -1 for unsynced (plain) lyrics. */
data class LyricLine(val timeMs: Long, val text: String)

data class Lyrics(val lines: List<LyricLine>, val synced: Boolean) {

    val isEmpty: Boolean get() = lines.isEmpty()

    /** Index of the line being sung at [positionMs], or -1 before the first line. */
    fun indexAt(positionMs: Long): Int {
        if (!synced || lines.isEmpty()) return -1
        var lo = 0
        var hi = lines.size - 1
        var answer = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (lines[mid].timeMs <= positionMs) {
                answer = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return answer
    }

    companion object {
        val EMPTY = Lyrics(emptyList(), synced = false)
    }
}

/**
 * Parses LRC text: "[mm:ss.xx] words". Handles several stamps on one line,
 * metadata tags such as [ar:...], and the [offset:+/-ms] tag.
 */
object LrcParser {
    private val stamp = Regex("""^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]""")
    private val offsetTag = Regex("""^\[offset:\s*([+-]?\d+)\s*]""", RegexOption.IGNORE_CASE)

    fun parseSynced(lrc: String): Lyrics {
        var offsetMs = 0L
        val out = ArrayList<LyricLine>()
        for (raw in lrc.lineSequence()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            val offset = offsetTag.find(line)
            if (offset != null) {
                offsetMs = offset.groupValues[1].toLongOrNull() ?: 0L
                continue
            }
            val times = ArrayList<Long>(2)
            var rest = line
            while (true) {
                val m = stamp.find(rest) ?: break
                val minutes = m.groupValues[1].toLong()
                val seconds = m.groupValues[2].toLong()
                val fraction = m.groupValues[3]
                val fractionMs = when (fraction.length) {
                    0 -> 0L
                    1 -> fraction.toLong() * 100
                    2 -> fraction.toLong() * 10
                    else -> fraction.take(3).toLong()
                }
                times += minutes * 60_000 + seconds * 1_000 + fractionMs
                rest = rest.substring(m.range.last + 1)
            }
            if (times.isEmpty()) continue
            val text = rest.trim()
            for (t in times) out += LyricLine((t - offsetMs).coerceAtLeast(0L), text)
        }
        out.sortBy { it.timeMs }
        return Lyrics(out, synced = out.isNotEmpty())
    }

    fun parsePlain(text: String): Lyrics {
        val lines = text.lines().map { it.trim() }.dropWhile { it.isEmpty() }.dropLastWhile { it.isEmpty() }
        return Lyrics(lines.map { LyricLine(-1, it) }, synced = false)
    }
}

/**
 * Music apps often add "- Remastered 2011" or "(feat. X)" to titles, which
 * stops an exact lyrics lookup from matching. These helpers strip that noise.
 */
object TitleCleaner {
    private val dashSuffix = Regex(
        """\s+[-–]\s+(\d{4}\s+)?(remaster(ed)?|live|radio edit|single version|mono|stereo|acoustic|edit|version|mix|remix)\b.*$""",
        RegexOption.IGNORE_CASE,
    )
    private val bracketFeat = Regex("""\s*[(\[](feat\.?|ft\.?|with)\s[^)\]]*[)\]]""", RegexOption.IGNORE_CASE)
    private val bracketNoise = Regex(
        """\s*[(\[][^)\]]*(remaster(ed)?|official|lyrics?|video|audio|live|explicit)[^)\]]*[)\]]""",
        RegexOption.IGNORE_CASE,
    )
    // Only clear separators. "&" stays, so band names such as "Ben&Ben" survive.
    private val artistSplit = Regex("""\s*(?:,|;|\s+(?:feat\.?|ft\.?|featuring)\s+)\s*""", RegexOption.IGNORE_CASE)

    fun clean(title: String): String =
        title.replace(bracketFeat, "").replace(bracketNoise, "").replace(dashSuffix, "").trim()

    fun mainArtist(artist: String): String =
        artist.split(artistSplit).firstOrNull { it.isNotBlank() }?.trim() ?: artist.trim()
}
