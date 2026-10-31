package com.genestjanramirez.gendrive.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Apps
import androidx.compose.material.icons.rounded.DirectionsCar
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Timeline
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.drive.Motion
import com.genestjanramirez.gendrive.core.settings.DriverSide
import com.genestjanramirez.gendrive.core.settings.ThemeMode
import com.genestjanramirez.gendrive.core.vehicle.DataSource
import com.genestjanramirez.gendrive.ui.components.AssistantOrb
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.Pill
import com.genestjanramirez.gendrive.ui.screens.AppsScreen
import com.genestjanramirez.gendrive.ui.screens.CarScreen
import com.genestjanramirez.gendrive.ui.screens.HomeScreen
import com.genestjanramirez.gendrive.ui.screens.MapsScreen
import com.genestjanramirez.gendrive.ui.screens.MediaScreen
import com.genestjanramirez.gendrive.ui.screens.SettingsScreen
import com.genestjanramirez.gendrive.ui.screens.TripsScreen
import com.genestjanramirez.gendrive.ui.theme.Gd
import com.genestjanramirez.gendrive.ui.theme.GenDriveTheme
import kotlinx.coroutines.delay
import java.util.Calendar

enum class Dest(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Rounded.Home),
    CAR("Car", Icons.Rounded.DirectionsCar),
    MEDIA("Music", Icons.Rounded.LibraryMusic),
    MAPS("Maps", Icons.Rounded.Map),
    APPS("Apps", Icons.Rounded.Apps),
    TRIPS("Trips", Icons.Rounded.Timeline),
    SETTINGS("Settings", Icons.Rounded.Settings),
}

@Composable
fun GenDriveRoot(graph: AppGraph) {
    var dest by rememberSaveable { mutableStateOf(Dest.HOME) }
    val settings by graph.settings.state.collectAsState()
    val dark = when (settings.theme) {
        ThemeMode.AUTO -> isSystemInDarkTheme()
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
    }
    GenDriveTheme(dark) {
        val c = Gd.colors
        val motion by graph.vehicle.motion.collectAsState()
        val moving = motion == Motion.MOVING
        BackHandler(enabled = dest != Dest.HOME) { dest = Dest.HOME }
        Box(Modifier.fillMaxSize().background(c.bg)) {
            // A soft glow in two corners: depth without distracting movement.
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(
                    Brush.radialGradient(listOf(c.mint.copy(alpha = if (c.isDark) 0.10f else 0.06f), c.bg.copy(alpha = 0f)), center = Offset(0f, 0f), radius = size.maxDimension * 0.55f),
                    radius = size.maxDimension * 0.55f, center = Offset(0f, 0f),
                )
                drawCircle(
                    Brush.radialGradient(listOf(c.blue.copy(alpha = if (c.isDark) 0.08f else 0.05f), c.bg.copy(alpha = 0f)), center = Offset(size.width, size.height), radius = size.maxDimension * 0.5f),
                    radius = size.maxDimension * 0.5f, center = Offset(size.width, size.height),
                )
            }
            val rail: @Composable () -> Unit = { NavRail(graph, dest) { dest = it } }
            val content: @Composable (Modifier) -> Unit = { m ->
                Column(m.fillMaxHeight().padding(start = 20.dp, end = 24.dp, top = 16.dp, bottom = 16.dp)) {
                    Header(graph, dest, moving)
                    Spacer(Modifier.height(16.dp))
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        when (dest) {
                            Dest.HOME -> HomeScreen(graph, moving) { dest = it }
                            Dest.CAR -> CarScreen(graph)
                            Dest.MEDIA -> MediaScreen(graph, moving) { dest = it }
                            Dest.MAPS -> MapsScreen(graph, moving) { dest = it }
                            Dest.APPS -> AppsScreen(graph, moving)
                            Dest.TRIPS -> TripsScreen(graph)
                            Dest.SETTINGS -> SettingsScreen(graph, moving)
                        }
                    }
                }
            }
            Row(Modifier.fillMaxSize()) {
                if (settings.driverSide == DriverSide.LEFT) {
                    rail()
                    content(Modifier.weight(1f))
                } else {
                    content(Modifier.weight(1f))
                    rail()
                }
            }
        }
    }
}

@Composable
private fun NavRail(graph: AppGraph, current: Dest, onSelect: (Dest) -> Unit) {
    val c = Gd.colors
    val context = LocalContext.current
    val assistant by graph.voice.ui.collectAsState()
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) graph.voice.toggleListening() else graph.voice.say("I need the microphone to hear you. You can allow it in Settings, under Setup.")
    }
    Column(
        Modifier
            .fillMaxHeight()
            .width(120.dp)
            .background(c.card.copy(alpha = if (c.isDark) 0.65f else 0.9f))
            .padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("G", style = MaterialTheme.typography.headlineMedium, color = c.mint)
        Spacer(Modifier.height(8.dp))
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Dest.entries.forEach { d -> RailItem(d, d == current) { onSelect(d) } }
        }
        AssistantOrb(assistant, onClick = {
            val hasMic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            if (hasMic) graph.voice.toggleListening() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }, diameter = 76.dp)
    }
}

@Composable
private fun RailItem(dest: Dest, selected: Boolean, onClick: () -> Unit) {
    val c = Gd.colors
    Column(
        Modifier
            .width(104.dp)
            .heightIn(min = 76.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(if (selected) c.mint.copy(alpha = 0.16f) else c.bg.copy(alpha = 0f))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(dest.icon, contentDescription = dest.label, tint = if (selected) c.mint else c.textMid, modifier = Modifier.size(30.dp))
        Spacer(Modifier.height(4.dp))
        Text(dest.label, style = MaterialTheme.typography.labelMedium, color = if (selected) c.mint else c.textMid, maxLines = 1)
    }
}

@Composable
private fun Header(graph: AppGraph, dest: Dest, moving: Boolean) {
    val c = Gd.colors
    val context = LocalContext.current
    val settings by graph.settings.state.collectAsState()
    val state by graph.vehicle.state.collectAsState()
    val assistant by graph.voice.ui.collectAsState()
    val now by produceState(System.currentTimeMillis()) {
        while (true) {
            value = System.currentTimeMillis()
            delay(15_000)
        }
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            val title = if (dest == Dest.HOME) greeting(settings.ownerName) else dest.label
            Text(title, style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val sub = assistant.reply?.takeIf { assistant.phase != com.genestjanramirez.gendrive.voice.AssistantPhase.IDLE }
                ?: listOf(settings.carModel.substringBefore(" ("), if (moving) "Driving" else "Parked").joinToString(" · ")
            Label(sub, maxLines = 1)
        }
        val (text, color) = when (state.source) {
            DataSource.BYD -> "Live car data" to c.mint
            DataSource.DEMO -> "Demo drive" to c.amber
            DataSource.NONE -> "No car data" to c.coral
        }
        Pill(text, color)
        Spacer(Modifier.width(20.dp))
        Text(Fmt.time(context, now), style = MaterialTheme.typography.titleLarge, color = c.text)
    }
}

private fun greeting(name: String): String {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val part = when (hour) {
        in 5..11 -> "Good morning"
        in 12..17 -> "Good afternoon"
        else -> "Good evening"
    }
    return if (name.isBlank()) part else "$part, ${name.trim()}"
}
