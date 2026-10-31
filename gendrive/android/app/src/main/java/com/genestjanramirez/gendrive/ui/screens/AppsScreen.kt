package com.genestjanramirez.gendrive.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.GetApp
import androidx.compose.material.icons.rounded.Usb
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.apps.AppCatalog
import com.genestjanramirez.gendrive.core.apps.CatalogApp
import com.genestjanramirez.gendrive.core.install.InstallGuide
import com.genestjanramirez.gendrive.ui.components.AppIcon
import com.genestjanramirez.gendrive.ui.components.GdButton
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.SectionTitle
import com.genestjanramirez.gendrive.ui.theme.Gd
import kotlinx.coroutines.launch

private enum class AppsTab(val label: String) { MINE("My apps"), GET("Get apps"), INSTALL("Install APK") }

@Composable
fun AppsScreen(graph: AppGraph, moving: Boolean) {
    var tab by rememberSaveable { mutableStateOf(AppsTab.MINE) }
    Column(Modifier.fillMaxSize()) {
        Segmented(AppsTab.entries.map { it.label }, AppsTab.entries.indexOf(tab)) { tab = AppsTab.entries[it] }
        Spacer(Modifier.height(18.dp))
        when (tab) {
            AppsTab.MINE -> MyApps(graph, moving)
            AppsTab.GET -> GetApps(graph)
            AppsTab.INSTALL -> InstallApk(graph, moving)
        }
    }
}

@Composable
fun Segmented(labels: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val c = Gd.colors
    Row(
        Modifier
            .clip(RoundedCornerShape(24.dp))
            .background(c.card)
            .padding(6.dp),
    ) {
        labels.forEachIndexed { i, label ->
            Box(
                Modifier
                    .heightIn(min = 60.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (i == selected) c.mint else c.card)
                    .clickable { onSelect(i) }
                    .padding(horizontal = 26.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = MaterialTheme.typography.labelLarge, color = if (i == selected) c.onAccent else c.textMid)
            }
        }
    }
}

@Composable
private fun MyApps(graph: AppGraph, moving: Boolean) {
    val apps by graph.apps.apps.collectAsState()
    val settings by graph.settings.state.collectAsState()
    var filter by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) {
        if (!moving) {
            OutlinedTextField(
                value = filter,
                onValueChange = { filter = it },
                label = { Text("Search apps") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        Label("Tap to open. Long-press to add to or remove from the Home dock (a dot marks dock apps).", color = Gd.colors.textLow)
        Spacer(Modifier.height(8.dp))
        val shown = apps.filter { filter.isBlank() || it.label.contains(filter.trim(), ignoreCase = true) }
        LazyVerticalGrid(columns = GridCells.Adaptive(132.dp), modifier = Modifier.fillMaxSize()) {
            items(shown, key = { it.packageName }) { app ->
                val inDock = app.packageName in settings.dockPackages
                AppIcon(
                    label = app.label,
                    icon = app.icon,
                    onClick = { graph.apps.launch(app.packageName) },
                    onLongClick = {
                        graph.settings.update { s ->
                            s.copy(dockPackages = if (inDock) s.dockPackages - app.packageName else (s.dockPackages + app.packageName).take(5))
                        }
                    },
                    badge = inDock,
                )
            }
        }
    }
}

@Composable
private fun GetApps(graph: AppGraph) {
    val context = LocalContext.current
    val apps by graph.apps.apps.collectAsState()
    val installed = apps.map { it.packageName }.toSet()
    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Label(
                "Install Aurora Store first: it downloads Play Store apps without a Google account. " +
                    "Some Google apps also need Google Play services, which most BYD head units don't have.",
            )
        }
        AppCatalog.byCategory().forEach { (category, list) ->
            item { SectionTitle(category.label) }
            items(list, key = { it.packageName }) { app ->
                CatalogRow(app, app.packageName in installed, onOpen = { graph.apps.launch(app.packageName) }, onGet = {
                    openStore(context, app)
                })
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

private fun openStore(context: android.content.Context, app: CatalogApp) {
    val first = Intent(Intent.ACTION_VIEW, Uri.parse(app.getUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
        context.startActivity(first)
    } catch (e: Exception) {
        // No store installed: the Play web page still shows what the app is.
        val web = "https://play.google.com/store/apps/details?id=${app.packageName}"
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(web)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (ignored: Exception) {
        }
    }
}

@Composable
private fun CatalogRow(app: CatalogApp, isInstalled: Boolean, onOpen: () -> Unit, onGet: () -> Unit) {
    val c = Gd.colors
    GdCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(app.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                app.note?.let { Label(it) }
            }
            Spacer(Modifier.width(16.dp))
            if (isInstalled) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = c.mint)
                    Spacer(Modifier.width(6.dp))
                    GdButton("Open", onClick = onOpen)
                }
            } else {
                GdButton("Get", onClick = onGet, icon = Icons.Rounded.GetApp, primary = true)
            }
        }
    }
}

@Composable
private fun InstallApk(graph: AppGraph, moving: Boolean) {
    val c = Gd.colors
    val scope = rememberCoroutineScope()
    val message by graph.apps.message.collectAsState()
    var viaAdb by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            if (!viaAdb) {
                graph.apps.installWithAndroid(uri)
            } else {
                graph.apps.postMessage("Sending the APK over ADB… if the car asks “Allow USB debugging?”, tap Allow.")
                val file = graph.apps.copyToCache(uri)
                if (file == null) {
                    graph.apps.postMessage("Couldn't read that file.")
                } else {
                    graph.adb.install(file)
                        .onSuccess {
                            graph.apps.postMessage("Installed with ADB.")
                            graph.apps.refresh()
                        }
                        .onFailure { graph.apps.postMessage("ADB install failed: ${it.message}. Is Wireless ADB switched on?") }
                }
            }
        }
    }
    val advice = InstallGuide.advise(graph.vehicle.info.countryCode)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        if (moving) {
            GdCard(Modifier.fillMaxWidth(), accent = c.amber) {
                Text("Installing apps is available when parked.", style = MaterialTheme.typography.titleMedium, color = c.text)
            }
            return@Column
        }
        GdCard(Modifier.fillMaxWidth()) {
            Text("Install an APK file", style = MaterialTheme.typography.titleMedium, color = c.text)
            Label("Pick an APK from a USB stick or Downloads. Only install apps from sources you trust.")
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                GdButton("Pick APK and install", onClick = {
                    viaAdb = false
                    picker.launch(arrayOf("application/vnd.android.package-archive", "application/octet-stream"))
                }, icon = Icons.Rounded.GetApp, primary = true, modifier = Modifier.weight(1f))
                GdButton("Install with ADB", onClick = {
                    viaAdb = true
                    picker.launch(arrayOf("application/vnd.android.package-archive", "application/octet-stream"))
                }, icon = Icons.Rounded.Usb, modifier = Modifier.weight(1f))
            }
            message?.let {
                Spacer(Modifier.height(14.dp))
                Text(it, style = MaterialTheme.typography.bodyLarge, color = c.mint)
            }
        }
        GdCard(Modifier.fillMaxWidth()) {
            Text("BYD's own USB installer", style = MaterialTheme.typography.titleMedium, color = c.text)
            Spacer(Modifier.height(6.dp))
            Label(advice.note)
            advice.folderNames.forEach { name ->
                Spacer(Modifier.height(8.dp))
                Text("Folder: “$name”", style = MaterialTheme.typography.titleMedium, color = c.mint)
            }
            if (advice.countryCode != null) Label("Your car's country code: ${advice.countryCode}", color = c.textLow)
        }
        GdCard(Modifier.fillMaxWidth()) {
            Text("Which button should I use?", style = MaterialTheme.typography.titleMedium, color = c.text)
            Label("“Pick APK and install” uses Android's normal installer. If your car refuses, use “Install with ADB”. It works once Wireless ADB is on (see the install guide).")
        }
        Spacer(Modifier.padding(bottom = 12.dp))
    }
}
