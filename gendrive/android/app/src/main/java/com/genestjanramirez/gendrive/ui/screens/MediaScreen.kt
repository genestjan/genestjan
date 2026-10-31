package com.genestjanramirez.gendrive.ui.screens

import android.os.SystemClock
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.Subtitles
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.lyrics.Lyrics
import com.genestjanramirez.gendrive.media.LyricsState
import com.genestjanramirez.gendrive.media.NowPlaying
import com.genestjanramirez.gendrive.ui.Dest
import com.genestjanramirez.gendrive.ui.Fmt
import com.genestjanramirez.gendrive.ui.components.GdButton
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.theme.Gd
import kotlinx.coroutines.delay

@Composable
fun MediaScreen(graph: AppGraph, moving: Boolean, go: (Dest) -> Unit) {
    val access by graph.media.hasAccess.collectAsState()
    val np by graph.media.nowPlaying.collectAsState()
    val lyrics by graph.lyrics.state.collectAsState()
    val now by produceState(SystemClock.elapsedRealtime()) {
        while (true) {
            value = SystemClock.elapsedRealtime()
            delay(200)
        }
    }
    if (!access) {
        GdCard(Modifier.fillMaxWidth()) {
            Text("Let GenDrive see what's playing", style = MaterialTheme.typography.titleLarge, color = Gd.colors.text)
            Spacer(Modifier.height(8.dp))
            Label("Android calls this “notification access”. GenDrive uses it only to show the song, the lyrics and the controls, and the next turn from Google Maps.")
            Spacer(Modifier.height(16.dp))
            GdButton("Open Setup", onClick = { go(Dest.SETTINGS) }, primary = true)
        }
        return
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth > maxHeight
        val track = np
        if (wide) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                PlayerCard(graph, track, now, Modifier.weight(0.9f).fillMaxSize())
                LyricsCard(lyrics, track, now, moving, Modifier.weight(1.1f).fillMaxSize())
            }
        } else {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                PlayerCard(graph, track, now, Modifier.fillMaxWidth())
                LyricsCard(lyrics, track, now, moving, Modifier.weight(1f).fillMaxWidth())
            }
        }
    }
}

@Composable
private fun PlayerCard(graph: AppGraph, track: NowPlaying?, now: Long, modifier: Modifier) {
    val c = Gd.colors
    var dragging by remember { mutableStateOf<Float?>(null) }
    GdCard(modifier) {
        Column(Modifier.verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
            val art = track?.art
            Box(
                Modifier.widthIn(max = 340.dp).fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(26.dp)).background(c.cardTop),
                contentAlignment = Alignment.Center,
            ) {
                if (art != null) {
                    Image(art.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Icon(Icons.Rounded.MusicNote, contentDescription = null, tint = c.mint, modifier = Modifier.size(96.dp))
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(track?.title?.ifBlank { null } ?: "Nothing playing", style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            Label(track?.let { "${it.artist} · ${it.appLabel}" } ?: "Start Spotify or any music app", maxLines = 1)
            if (track != null && track.durationMs > 0) {
                val pos = track.positionAt(now)
                Slider(
                    value = dragging ?: (pos.toFloat() / track.durationMs).coerceIn(0f, 1f),
                    onValueChange = { dragging = it },
                    onValueChangeFinished = {
                        dragging?.let { graph.media.seekTo((it * track.durationMs).toLong()) }
                        dragging = null
                    },
                    colors = SliderDefaults.colors(thumbColor = c.mint, activeTrackColor = c.mint, inactiveTrackColor = c.border),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Row(Modifier.fillMaxWidth()) {
                    Label(Fmt.clock(pos), modifier = Modifier.weight(1f))
                    Label(Fmt.clock(track.durationMs))
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                RoundIcon(Icons.Rounded.SkipPrevious, "Previous") { graph.media.previous() }
                RoundIcon(if (track?.isPlaying == true) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, "Play or pause", big = true) { graph.media.playPause() }
                RoundIcon(Icons.Rounded.SkipNext, "Next") { graph.media.next() }
            }
            if (track != null) {
                Spacer(Modifier.height(14.dp))
                GdButton("Open ${track.appLabel}", onClick = { graph.media.openPlayer() })
            }
        }
    }
}

@Composable
private fun LyricsCard(state: LyricsState, track: NowPlaying?, now: Long, moving: Boolean, modifier: Modifier) {
    val c = Gd.colors
    GdCard(modifier, contentPadding = PaddingValues(start = 26.dp, end = 26.dp, top = 22.dp, bottom = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Subtitles, contentDescription = null, tint = c.mint, modifier = Modifier.size(24.dp))
            Spacer(Modifier.size(10.dp))
            Text("Lyrics", style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            Label("from LRCLIB", color = c.textLow)
        }
        Spacer(Modifier.height(12.dp))
        when (state) {
            LyricsState.Off -> Message("Lyrics are switched off in Settings.")
            LyricsState.Idle -> Message("Play a song and its lyrics appear here.")
            is LyricsState.Loading -> Message("Finding the lyrics…")
            is LyricsState.Instrumental -> Message("♪ Instrumental")
            is LyricsState.Missing -> Message("No lyrics found for this song.")
            is LyricsState.Error -> Message("Couldn't load lyrics (${state.message}). Check the car's internet.")
            is LyricsState.Ready -> SyncedLyrics(state.lyrics, track?.positionAt(now) ?: 0L, moving)
        }
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxWidth().heightIn(min = 200.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = Gd.colors.textMid, textAlign = TextAlign.Center)
    }
}

/**
 * Karaoke-style lyrics. While moving, only the current and next line show, in
 * large type, so a glance is enough and there is nothing to read through.
 */
@Composable
private fun SyncedLyrics(lyrics: Lyrics, positionMs: Long, moving: Boolean) {
    val c = Gd.colors
    val index = lyrics.indexAt(positionMs)
    if (moving && lyrics.synced) {
        val current = lyrics.lines.getOrNull(index)?.text?.ifBlank { "♪" } ?: "♪"
        val next = lyrics.lines.getOrNull(index + 1)?.text.orEmpty()
        Column(Modifier.fillMaxWidth().heightIn(min = 220.dp), verticalArrangement = Arrangement.Center) {
            Text(current, style = MaterialTheme.typography.headlineMedium, color = c.mint, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(14.dp))
            Text(next, style = MaterialTheme.typography.titleMedium, color = c.textMid, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        return
    }
    val listState = rememberLazyListState()
    LaunchedEffect(index) {
        if (lyrics.synced && index >= 0) listState.animateScrollToItem((index - 2).coerceAtLeast(0))
    }
    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        itemsIndexed(lyrics.lines) { i, line ->
            val active = lyrics.synced && i == index
            val color by animateColorAsState(
                when {
                    !lyrics.synced -> c.text
                    active -> c.mint
                    i < index -> c.textLow
                    else -> c.textMid
                },
                label = "lyric",
            )
            Text(
                line.text.ifBlank { "♪" },
                style = if (active) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                color = color,
            )
        }
    }
}
