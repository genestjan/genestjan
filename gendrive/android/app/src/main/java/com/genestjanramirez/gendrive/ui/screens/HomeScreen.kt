package com.genestjanramirez.gendrive.ui.screens

import android.os.SystemClock
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Navigation
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.Work
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.trip.EnergyMath
import com.genestjanramirez.gendrive.core.trip.TripStats
import com.genestjanramirez.gendrive.media.LyricsState
import com.genestjanramirez.gendrive.nav.MapsLauncher
import com.genestjanramirez.gendrive.ui.Dest
import com.genestjanramirez.gendrive.ui.Fmt
import com.genestjanramirez.gendrive.ui.components.AppIcon
import com.genestjanramirez.gendrive.ui.components.BatteryRing
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.GearStrip
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.theme.Gd
import kotlinx.coroutines.delay
import java.util.Calendar
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun HomeScreen(graph: AppGraph, moving: Boolean, go: (Dest) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth > maxHeight
        Column(Modifier.fillMaxSize()) {
            TripCompleteBanner(graph)
            if (wide) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Column(Modifier.weight(1.1f).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        DriveCard(graph, Modifier.weight(1f).fillMaxWidth())
                        NowPlayingCard(graph, moving, go, Modifier.fillMaxWidth())
                    }
                    Column(Modifier.weight(1f).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        NextTurnCard(graph, go, Modifier.weight(1f).fillMaxWidth())
                        if (!moving) SavingsCard(graph, go, Modifier.fillMaxWidth())
                        Dock(graph, go)
                    }
                }
            } else {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    DriveCard(graph, Modifier.fillMaxWidth().height(300.dp))
                    NextTurnCard(graph, go, Modifier.fillMaxWidth())
                    NowPlayingCard(graph, moving, go, Modifier.fillMaxWidth())
                    if (!moving) SavingsCard(graph, go, Modifier.fillMaxWidth())
                    Dock(graph, go)
                }
            }
        }
    }
}

@Composable
private fun DriveCard(graph: AppGraph, modifier: Modifier) {
    val c = Gd.colors
    val state by graph.vehicle.state.collectAsState()
    val settings by graph.settings.state.collectAsState()
    GdCard(modifier) {
        Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Label("Speed")
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(Fmt.speed(state.speedKmh, settings.distanceUnit), style = MaterialTheme.typography.displayLarge, color = c.text)
                    Spacer(Modifier.width(8.dp))
                    Text(Fmt.speedUnit(settings.distanceUnit), style = MaterialTheme.typography.titleMedium, color = c.textMid, modifier = Modifier.padding(bottom = 16.dp))
                }
                Spacer(Modifier.height(8.dp))
                GearStrip(state.gear)
                Spacer(Modifier.height(16.dp))
                val outside = state.outsideTempC?.let { "${it.roundToInt()}°C outside" }
                val power = if (state.isCharging) state.chargePowerKw?.let { "Charging ${Fmt.one(it)} kW" } else null
                Label(listOfNotNull(power, outside).joinToString("  ·  ").ifEmpty { " " })
            }
            BatteryRing(
                soc = state.socPercent,
                charging = state.isCharging,
                diameter = 210.dp,
                caption = state.rangeKm?.let { Fmt.distance(it.toDouble(), settings.distanceUnit) + " range" },
            )
        }
    }
}

@Composable
private fun NowPlayingCard(graph: AppGraph, moving: Boolean, go: (Dest) -> Unit, modifier: Modifier) {
    val c = Gd.colors
    val np by graph.media.nowPlaying.collectAsState()
    val access by graph.media.hasAccess.collectAsState()
    val lyrics by graph.lyrics.state.collectAsState()
    val now by produceState(SystemClock.elapsedRealtime()) {
        while (true) {
            value = SystemClock.elapsedRealtime()
            delay(250)
        }
    }
    GdCard(modifier, onClick = { go(Dest.MEDIA) }) {
        val track = np
        if (!access) {
            Label("Music")
            Text("Let GenDrive see what's playing", style = MaterialTheme.typography.titleMedium, color = c.text)
            Label("Settings › Setup › “See what's playing”. Then lyrics and controls appear here.")
            return@GdCard
        }
        if (track == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.MusicNote, contentDescription = null, tint = c.textMid, modifier = Modifier.size(40.dp))
                Spacer(Modifier.width(16.dp))
                Column {
                    Text("Nothing playing", style = MaterialTheme.typography.titleMedium, color = c.text)
                    Label("Start Spotify or any music app")
                }
            }
            return@GdCard
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            val art = track.art
            if (art != null) {
                Image(art.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(88.dp).clip(RoundedCornerShape(18.dp)))
            } else {
                Box(Modifier.size(88.dp).clip(RoundedCornerShape(18.dp)).background(c.cardTop), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.MusicNote, contentDescription = null, tint = c.mint, modifier = Modifier.size(40.dp))
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(track.title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Label("${track.artist} · ${track.appLabel}", maxLines = 1)
            }
            RoundIcon(Icons.Rounded.SkipPrevious, "Previous") { graph.media.previous() }
            RoundIcon(if (track.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, "Play or pause", big = true) { graph.media.playPause() }
            RoundIcon(Icons.Rounded.SkipNext, "Next") { graph.media.next() }
        }
        val current = (lyrics as? LyricsState.Ready)?.lyrics?.let { l ->
            val i = l.indexAt(track.positionAt(now))
            if (i >= 0) l.lines[i].text else null
        }
        if (!current.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(current, style = if (moving) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium, color = c.mint, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun RoundIcon(icon: ImageVector, description: String, big: Boolean = false, onClick: () -> Unit) {
    val c = Gd.colors
    Box(
        Modifier
            .padding(horizontal = 4.dp)
            .size(if (big) 76.dp else 64.dp)
            .clip(CircleShape)
            .background(if (big) c.mint else c.cardTop)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = if (big) c.onAccent else c.text, modifier = Modifier.size(if (big) 40.dp else 32.dp))
    }
}

@Composable
private fun NextTurnCard(graph: AppGraph, go: (Dest) -> Unit, modifier: Modifier) {
    val c = Gd.colors
    val context = LocalContext.current
    val live by graph.nav.live.collectAsState()
    val settings by graph.settings.state.collectAsState()
    val nav = live
    if (nav != null) {
        GdCard(modifier, onClick = { MapsLauncher.openApp(context, nav.instruction.appPackage) }, accent = c.blue) {
            Label("Next turn · ${if (nav.instruction.appPackage.contains("waze")) "Waze" else "Google Maps"}")
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val arrow = nav.arrow
                if (arrow != null) {
                    Image(arrow.asImageBitmap(), contentDescription = null, modifier = Modifier.size(96.dp))
                } else {
                    Icon(Icons.Rounded.Navigation, contentDescription = null, tint = c.blue, modifier = Modifier.size(80.dp))
                }
                Spacer(Modifier.width(18.dp))
                Column {
                    Text(nav.instruction.distanceText ?: "", style = MaterialTheme.typography.displayMedium, color = c.text)
                    Text(nav.instruction.instruction, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            nav.instruction.eta?.let {
                Spacer(Modifier.height(10.dp))
                Label(it, maxLines = 1)
            }
        }
        return
    }
    GdCard(modifier) {
        Label("Where to?")
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            PlaceButton("Home", Icons.Rounded.Home, settings.homeAddress, Modifier.weight(1f)) {
                if (settings.homeAddress.isBlank()) go(Dest.MAPS) else MapsLauncher.navigate(context, settings.homeAddress)
            }
            PlaceButton("Work", Icons.Rounded.Work, settings.workAddress, Modifier.weight(1f)) {
                if (settings.workAddress.isBlank()) go(Dest.MAPS) else MapsLauncher.navigate(context, settings.workAddress)
            }
            PlaceButton("Search", Icons.Rounded.Search, "", Modifier.weight(1f)) { go(Dest.MAPS) }
        }
    }
}

@Composable
private fun PlaceButton(label: String, icon: ImageVector, address: String, modifier: Modifier, onClick: () -> Unit) {
    val c = Gd.colors
    Column(
        modifier
            .clip(RoundedCornerShape(22.dp))
            .background(c.blue.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Icon(icon, contentDescription = null, tint = c.blue, modifier = Modifier.size(34.dp))
        Spacer(Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.titleMedium, color = c.text)
        Label(if (label == "Search") "Any place" else address.ifBlank { "Tap to set" }, maxLines = 1)
    }
}

@Composable
private fun SavingsCard(graph: AppGraph, go: (Dest) -> Unit, modifier: Modifier) {
    val c = Gd.colors
    val trips by graph.trips.trips.collectAsState()
    val settings by graph.settings.state.collectAsState()
    val cal = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
    }
    val month = TripStats.summarise(TripStats.since(trips, cal.timeInMillis), settings.cost)
    val change = TripStats.weekOverWeekChangePct(trips, System.currentTimeMillis())
    GdCard(modifier, onClick = { go(Dest.TRIPS) }) {
        Label("Saved this month vs petrol")
        Text(Fmt.money(month.saved.coerceAtLeast(0.0), settings.cost.currency), style = MaterialTheme.typography.headlineLarge, color = c.mint)
        val detail = if (month.trips == 0) {
            "Drive a little and your savings appear here."
        } else {
            "${Fmt.distance(month.distanceKm, settings.distanceUnit)} · electricity ${Fmt.money(month.electricityCost, settings.cost.currency)}"
        }
        Label(detail, maxLines = 1)
        if (change != null) {
            Spacer(Modifier.height(6.dp))
            val better = change < 0
            Label(
                if (better) "Great driving: ${abs(change).roundToInt()}% less energy per km than last week." else "Tip: gentle starts save energy. ${change.roundToInt()}% more than last week.",
                color = if (better) c.mint else c.amber,
            )
        }
    }
}

@Composable
private fun Dock(graph: AppGraph, go: (Dest) -> Unit) {
    val apps by graph.apps.apps.collectAsState()
    val settings by graph.settings.state.collectAsState()
    val docked = settings.dockPackages.mapNotNull { pkg -> apps.firstOrNull { it.packageName == pkg } }.take(5)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        docked.forEach { app ->
            AppIcon(app.label, app.icon, onClick = { graph.apps.launch(app.packageName) }, modifier = Modifier.weight(1f))
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            RoundIcon(Icons.Rounded.Add, "Add apps to the dock") { go(Dest.APPS) }
        }
    }
}

@Composable
private fun TripCompleteBanner(graph: AppGraph) {
    val c = Gd.colors
    val trip by graph.trips.lastFinished.collectAsState()
    val settings by graph.settings.state.collectAsState()
    val t = trip ?: return
    if (System.currentTimeMillis() - t.endMs > 30 * 60_000L) return
    val cost = t.energyKwh?.let { EnergyMath.electricityCost(it, settings.cost.pricePerKwh, settings.cost.chargingLossPct) }
    val saved = cost?.let { EnergyMath.petrolCost(t.distanceKm, settings.cost.petrolLitresPer100Km, settings.cost.petrolPricePerLitre) - it }
    GdCard(Modifier.fillMaxWidth().padding(bottom = 20.dp), accent = c.mint, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 22.dp, vertical = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Trip complete", style = MaterialTheme.typography.titleMedium, color = c.mint)
                val parts = listOfNotNull(
                    Fmt.distance(t.distanceKm, settings.distanceUnit),
                    t.consumptionKwhPer100()?.let { "${Fmt.one(it)} kWh/100 km" },
                    cost?.let { "cost ${Fmt.money(it, settings.cost.currency)}" },
                    saved?.takeIf { it > 0 }?.let { "saved ${Fmt.money(it, settings.cost.currency)} vs petrol" },
                )
                Label(parts.joinToString("  ·  "), maxLines = 1)
            }
            RoundIcon(Icons.Rounded.Close, "Dismiss") { graph.trips.dismissFinished() }
        }
    }
}
