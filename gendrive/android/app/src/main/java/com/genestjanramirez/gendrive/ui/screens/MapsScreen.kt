package com.genestjanramirez.gendrive.ui.screens

import android.app.Activity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.EvStation
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LocalCafe
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.LocalParking
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.Navigation
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Work
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.maps.MapsLinks
import com.genestjanramirez.gendrive.core.maps.QuickSearches
import com.genestjanramirez.gendrive.nav.MapsLauncher
import com.genestjanramirez.gendrive.ui.Dest
import com.genestjanramirez.gendrive.ui.components.GdButton
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.SectionTitle
import com.genestjanramirez.gendrive.ui.components.Tile
import com.genestjanramirez.gendrive.ui.theme.Gd

private enum class PlaceSlot { HOME, WORK, FAVOURITE }

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MapsScreen(graph: AppGraph, moving: Boolean, go: (Dest) -> Unit) {
    val c = Gd.colors
    val context = LocalContext.current
    val settings by graph.settings.state.collectAsState()
    val live by graph.nav.live.collectAsState()
    var query by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<PlaceSlot?>(null) }
    val mapsInstalled = MapsLauncher.isInstalled(context, MapsLinks.GOOGLE_MAPS_PACKAGE)
    val wazeInstalled = MapsLauncher.isInstalled(context, MapsLinks.WAZE_PACKAGE)
    val inSplitScreen = (context as? Activity)?.isInMultiWindowMode == true
    // Typing is for parked moments: close the address box as soon as the car moves.
    LaunchedEffect(moving) { if (moving) editing = null }

    fun navigate(destination: String) {
        if (destination.isNotBlank()) MapsLauncher.navigate(context, destination, adjacent = inSplitScreen)
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        if (!mapsInstalled) {
            GdCard(Modifier.fillMaxWidth(), accent = c.amber) {
                Text("Google Maps isn't installed on this car yet", style = MaterialTheme.typography.titleMedium, color = c.text)
                Label("GenDrive hands navigation to the real Google Maps app, so you get every Google Maps feature. Until it's installed, routes open in the browser.")
                Spacer(Modifier.height(12.dp))
                GdButton("Get Google Maps", onClick = { go(Dest.APPS) }, primary = true)
            }
        }

        GdCard(Modifier.fillMaxWidth()) {
            if (moving) {
                Text("Where to?", style = MaterialTheme.typography.titleMedium, color = c.text)
                Label("Typing is off while driving. Tap a saved place below, or tap the mic and say where.")
            } else {
                Row {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        label = { Text("Where to?") },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyLarge,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { navigate(query) }),
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(14.dp))
                    GdButton("Go", onClick = { navigate(query) }, icon = Icons.Rounded.Navigation, primary = true, enabled = query.isNotBlank())
                }
            }
        }

        live?.let { nav ->
            GdCard(Modifier.fillMaxWidth(), accent = c.blue, onClick = { MapsLauncher.openApp(context, nav.instruction.appPackage) }) {
                Label("Navigating now")
                Text(listOfNotNull(nav.instruction.distanceText, nav.instruction.instruction).joinToString(" · "), style = MaterialTheme.typography.titleMedium, color = c.text)
                nav.instruction.eta?.let { Label(it) }
            }
        }

        SectionTitle("Saved places")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            SavedPlace("Home", Icons.Rounded.Home, settings.homeAddress, onTap = {
                if (settings.homeAddress.isBlank()) editing = PlaceSlot.HOME else navigate(settings.homeAddress)
            }, onEdit = { if (!moving) editing = PlaceSlot.HOME })
            SavedPlace("Work", Icons.Rounded.Work, settings.workAddress, onTap = {
                if (settings.workAddress.isBlank()) editing = PlaceSlot.WORK else navigate(settings.workAddress)
            }, onEdit = { if (!moving) editing = PlaceSlot.WORK })
            settings.favouritePlaces.forEach { place ->
                SavedPlace(place, Icons.Rounded.Star, place, onTap = { navigate(place) }, onEdit = {
                    if (!moving) graph.settings.update { s -> s.copy(favouritePlaces = s.favouritePlaces - place) }
                })
            }
            if (!moving) {
                SavedPlace("Add place", Icons.Rounded.Place, "", onTap = { editing = PlaceSlot.FAVOURITE }, onEdit = {})
            }
        }
        Label("Long-press a saved place to change it, or to remove a favourite.", color = c.textLow)

        SectionTitle("Find nearby")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            QuickSearches.all.forEach { q ->
                Tile(q.label, iconFor(q.label), onClick = { MapsLauncher.search(context, q.query, adjacent = inSplitScreen) }, modifier = Modifier.width(180.dp), tint = c.blue)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            GdButton("Open Google Maps", onClick = { MapsLauncher.openGoogleMaps(context, inSplitScreen) }, icon = Icons.Rounded.Map, enabled = mapsInstalled, modifier = Modifier.weight(1f))
            if (wazeInstalled) {
                GdButton("Open Waze", onClick = { MapsLauncher.openApp(context, MapsLinks.WAZE_PACKAGE, inSplitScreen) }, icon = Icons.Rounded.Navigation, modifier = Modifier.weight(1f))
            }
        }
        if (inSplitScreen) Label("Split screen is on: maps open beside GenDrive.", color = c.textLow)
    }

    editing?.let { slot ->
        PlaceDialog(
            title = when (slot) {
                PlaceSlot.HOME -> "Home address"
                PlaceSlot.WORK -> "Work address"
                PlaceSlot.FAVOURITE -> "Add a favourite place"
            },
            initial = when (slot) {
                PlaceSlot.HOME -> settings.homeAddress
                PlaceSlot.WORK -> settings.workAddress
                PlaceSlot.FAVOURITE -> ""
            },
            onDismiss = { editing = null },
            onSave = { value ->
                graph.settings.update { s ->
                    when (slot) {
                        PlaceSlot.HOME -> s.copy(homeAddress = value)
                        PlaceSlot.WORK -> s.copy(workAddress = value)
                        PlaceSlot.FAVOURITE -> if (value.isBlank()) s else s.copy(favouritePlaces = (s.favouritePlaces + value).distinct())
                    }
                }
                editing = null
            },
        )
    }
}

@Composable
private fun SavedPlace(label: String, icon: ImageVector, address: String, onTap: () -> Unit, onEdit: () -> Unit) {
    Tile(
        label = label,
        icon = icon,
        onClick = onTap,
        onLongClick = onEdit,
        subtitle = if (address.isBlank() || address == label) "Tap to set" else address,
        tint = Gd.colors.blue,
        modifier = Modifier.width(220.dp),
    )
}

@Composable
private fun PlaceDialog(title: String, initial: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                label = { Text("Place name or address") },
                textStyle = MaterialTheme.typography.bodyLarge,
            )
        },
        confirmButton = { TextButton(onClick = { onSave(text.trim()) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

private fun iconFor(label: String): ImageVector = when (label) {
    "EV charging" -> Icons.Rounded.EvStation
    "Food" -> Icons.Rounded.Restaurant
    "Coffee" -> Icons.Rounded.LocalCafe
    "Parking" -> Icons.Rounded.LocalParking
    "Hospital" -> Icons.Rounded.LocalHospital
    "BYD service" -> Icons.Rounded.Build
    else -> Icons.Rounded.Search
}
