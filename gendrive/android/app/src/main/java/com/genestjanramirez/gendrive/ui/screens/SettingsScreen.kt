package com.genestjanramirez.gendrive.ui.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Usb
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.BuildConfig
import com.genestjanramirez.gendrive.core.install.InstallGuide
import com.genestjanramirez.gendrive.core.settings.BatteryPresets
import com.genestjanramirez.gendrive.core.settings.DataMode
import com.genestjanramirez.gendrive.core.settings.DriverSide
import com.genestjanramirez.gendrive.core.settings.ThemeMode
import com.genestjanramirez.gendrive.core.vehicle.DistanceUnit
import com.genestjanramirez.gendrive.core.vehicle.PressureUnit
import com.genestjanramirez.gendrive.core.vehicle.Units
import com.genestjanramirez.gendrive.system.Access
import com.genestjanramirez.gendrive.system.Permissions
import com.genestjanramirez.gendrive.ui.components.GdButton
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.SectionTitle
import com.genestjanramirez.gendrive.ui.components.SettingSwitch
import com.genestjanramirez.gendrive.ui.theme.Gd
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(graph: AppGraph, moving: Boolean) {
    val c = Gd.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val s by graph.settings.state.collectAsState()
    val info = graph.vehicle.info
    var adbResult by remember { mutableStateOf<String?>(null) }
    var pickModel by remember { mutableStateOf(false) }
    var pickVoice by remember { mutableStateOf(false) }
    var homeEnabled by remember { mutableStateOf(Permissions.isHomeEnabled(context)) }
    val access by produceState(Access.entries.associateWith { false }) {
        while (true) {
            value = Access.entries.associateWith { Permissions.granted(context, it) }
            delay(1_500)
        }
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        if (moving) {
            GdCard(Modifier.fillMaxWidth(), accent = c.amber) {
                Text("Settings can be changed when parked.", style = MaterialTheme.typography.titleMedium, color = c.text)
            }
        }

        // ── Setup ─────────────────────────────────────────────
        SectionTitle("Setup checklist")
        GdCard(Modifier.fillMaxWidth()) {
            val carOk = info.bydApiPresent
            CheckRow(
                ok = carOk,
                title = if (carOk) "Car data connected" else "No BYD car data found",
                detail = if (carOk) "Reading speed, battery, tyres and charging from the car." else "Normal on a phone: GenDrive uses its demo drive instead.",
            )
            Access.entries.forEach { a ->
                val ok = access[a] == true
                CheckRow(ok = ok, title = a.title, detail = a.why) {
                    if (a == Access.MICROPHONE) {
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    } else if (!Permissions.openSettings(context, a)) {
                        adbResult = "That settings screen is hidden on this car. Use “Fix everything with ADB” below."
                    }
                }
            }
            if (Permissions.hasBydAutostart(context)) {
                CheckRow(
                    ok = false,
                    title = "Let GenDrive start with the car",
                    detail = "BYD's own autostart list. Find GenDrive and allow it, so the greeting and trip log start by themselves.",
                ) { Permissions.openBydAutostart(context) }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                GdButton("Fix everything with ADB", onClick = {
                    adbResult = "Connecting… if the car asks “Allow USB debugging?”, tick Always allow and tap Allow."
                    scope.launch {
                        adbResult = graph.adb.grantGenDrivePermissions().fold(
                            onSuccess = { "Done:\n$it" },
                            onFailure = { "Couldn't connect to ADB (${it.message}). Switch on Wireless ADB first. See the install guide." },
                        )
                    }
                }, icon = Icons.Rounded.Usb, primary = true, enabled = !moving, modifier = Modifier.weight(1f))
                GdButton("Test ADB", onClick = {
                    scope.launch {
                        adbResult = graph.adb.test().fold(onSuccess = { it }, onFailure = { "Not connected: ${it.message}" })
                    }
                }, enabled = !moving, modifier = Modifier.weight(1f))
            }
            adbResult?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, style = MaterialTheme.typography.bodySmall, color = c.textMid)
            }
        }

        // ── Assistant ─────────────────────────────────────────
        SectionTitle("Voice assistant")
        GdCard(Modifier.fillMaxWidth()) {
            TextSetting("Assistant's name", s.assistantName, enabled = !moving) { v -> graph.settings.update { it.copy(assistantName = v) } }
            Spacer(Modifier.height(10.dp))
            TextSetting("Gemini API key (optional)", s.geminiApiKey, enabled = !moving, secret = true) { v -> graph.settings.update { it.copy(geminiApiKey = v) } }
            Label(
                "With your own key, the assistant can hold a real conversation. Get a key at aistudio.google.com/apikey. " +
                    "Your voice clip and car status go only to Google. On Google's free tier, Google may use them to improve its products.",
                maxLines = 4,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://aistudio.google.com/apikey")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    } catch (e: Exception) {
                        adbResult = "No browser found on this car."
                    }
                }, enabled = !moving) { Text("Open aistudio.google.com", color = c.blue) }
            }
            TextSetting("Gemini model", s.geminiModel, enabled = !moving) { v -> graph.settings.update { it.copy(geminiModel = v) } }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                GdButton("Choose voice", onClick = { pickVoice = true }, icon = Icons.AutoMirrored.Rounded.VolumeUp, enabled = !moving, modifier = Modifier.weight(1f))
                GdButton("Hear a sample", onClick = { graph.voice.preview() }, modifier = Modifier.weight(1f))
            }
            SettingSwitch("Welcome greeting", "Says hello with your battery and range when the car starts.", s.spokenGreeting, { v -> graph.settings.update { it.copy(spokenGreeting = v) } }, enabled = !moving)
            SettingSwitch("Trip and charging summaries", "Tells you the distance, cost and savings when you park or finish charging.", s.spokenTripSummaries, { v -> graph.settings.update { it.copy(spokenTripSummaries = v) } }, enabled = !moving)
            SettingSwitch("Spoken warnings", "Low battery and low tyre pressure.", s.spokenWarnings, { v -> graph.settings.update { it.copy(spokenWarnings = v) } }, enabled = !moving)
        }

        // ── You and your car ──────────────────────────────────
        SectionTitle("You and your car")
        GdCard(Modifier.fillMaxWidth()) {
            TextSetting("Your name (for the greeting)", s.ownerName, enabled = !moving) { v -> graph.settings.update { it.copy(ownerName = v) } }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Label("Car")
                    Text(s.carModel, style = MaterialTheme.typography.bodyLarge, color = c.text)
                }
                GdButton("Change", onClick = { pickModel = true }, enabled = !moving)
            }
            Spacer(Modifier.height(10.dp))
            NumberSetting("Usable battery (kWh)", s.cost.batteryCapacityKwh, enabled = !moving) { v -> graph.settings.updateCost { it.copy(batteryCapacityKwh = v) } }
        }

        // ── Money ─────────────────────────────────────────────
        SectionTitle("Money")
        GdCard(Modifier.fillMaxWidth()) {
            TextSetting("Currency symbol", s.cost.currency, enabled = !moving) { v -> graph.settings.updateCost { it.copy(currency = v) } }
            NumberSetting("Electricity price per kWh", s.cost.pricePerKwh, enabled = !moving) { v -> graph.settings.updateCost { it.copy(pricePerKwh = v) } }
            NumberSetting("Charging losses (%)", s.cost.chargingLossPct, enabled = !moving) { v -> graph.settings.updateCost { it.copy(chargingLossPct = v) } }
            NumberSetting("Petrol price per litre", s.cost.petrolPricePerLitre, enabled = !moving) { v -> graph.settings.updateCost { it.copy(petrolPricePerLitre = v) } }
            NumberSetting("A similar petrol car uses (L/100 km)", s.cost.petrolLitresPer100Km, enabled = !moving) { v -> graph.settings.updateCost { it.copy(petrolLitresPer100Km = v) } }
            Label("Defaults are examples. Check your Meralco or electric co-op bill for your real rate.", color = c.textLow)
        }

        // ── Display ───────────────────────────────────────────
        SectionTitle("Units and display")
        GdCard(Modifier.fillMaxWidth()) {
            Label("Theme")
            Segmented(listOf("Auto", "Dark", "Light"), ThemeMode.entries.indexOf(s.theme)) { i -> graph.settings.update { it.copy(theme = ThemeMode.entries[i]) } }
            Spacer(Modifier.height(14.dp))
            Label("Driver sits on the")
            Segmented(listOf("Left", "Right"), DriverSide.entries.indexOf(s.driverSide)) { i -> graph.settings.update { it.copy(driverSide = DriverSide.entries[i]) } }
            Spacer(Modifier.height(14.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Column {
                    Label("Distance")
                    Segmented(listOf("km", "miles"), DistanceUnit.entries.indexOf(s.distanceUnit)) { i -> graph.settings.update { it.copy(distanceUnit = DistanceUnit.entries[i]) } }
                }
                Column {
                    Label("Tyre pressure")
                    Segmented(PressureUnit.entries.map { it.label }, PressureUnit.entries.indexOf(s.pressureUnit)) { i -> graph.settings.update { it.copy(pressureUnit = PressureUnit.entries[i]) } }
                }
            }
            Spacer(Modifier.height(10.dp))
            NumberSetting("Warn when a tyre is below (${s.pressureUnit.label})", Units.kpaTo(s.pressureUnit, s.lowTyreKpa), enabled = !moving) { v ->
                val kpa = Units.kpaTo(s.pressureUnit, 1.0).let { perUnit -> v / perUnit }
                graph.settings.update { it.copy(lowTyreKpa = kpa) }
            }
            SettingSwitch("Lyrics", "Show synced lyrics for the song that's playing.", s.lyricsEnabled, { v -> graph.settings.update { it.copy(lyricsEnabled = v) } })
            SettingSwitch(
                "Use GenDrive as the home screen",
                "Then press Home and pick GenDrive. Switch this off to get BYD's own home screen back.",
                homeEnabled,
                { v ->
                    Permissions.setHomeEnabled(context, v)
                    homeEnabled = v
                    if (v) Permissions.openHomeSettings(context)
                },
                enabled = !moving,
            )
        }

        // ── Data and video ────────────────────────────────────
        SectionTitle("Car data and video")
        GdCard(Modifier.fillMaxWidth()) {
            Label("Where the numbers come from")
            Segmented(listOf("Automatic", "Car only", "Demo drive"), DataMode.entries.indexOf(s.dataMode)) { i -> graph.settings.update { it.copy(dataMode = DataMode.entries[i]) } }
            Spacer(Modifier.height(10.dp))
            Label("${InstallGuide.dilinkGuess(info.sdkInt)} · ${info.model} · firmware ${info.firmware}" + (info.countryCode?.let { " · country code $it" } ?: ""), color = c.textLow, maxLines = 3)
            Spacer(Modifier.height(14.dp))
            Text("Video rule", style = MaterialTheme.typography.titleMedium, color = c.text)
            Label(
                "Video apps play with sound while the car can move, and the picture returns when you shift to P. " +
                    "This needs “See which app is on screen” and “Draw over other apps” from the checklist.",
                maxLines = 4,
            )
            SettingSwitch(
                "Test the video rule with the demo drive",
                "For trying it on a phone. Leave off in the car.",
                s.videoGuardOnDemoData,
                { v -> graph.settings.update { it.copy(videoGuardOnDemoData = v) } },
                enabled = !moving,
            )
        }

        // ── About ─────────────────────────────────────────────
        SectionTitle("About")
        GdCard(Modifier.fillMaxWidth()) {
            Text("GenDrive ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.titleMedium, color = c.text)
            Label("Everything stays in your car. No account, no GenDrive server, no tracking.", maxLines = 3)
            Spacer(Modifier.height(8.dp))
            Label(
                "Not made or endorsed by BYD. Car-data method names come from public research: OverDrive (MIT) and " +
                    "byd-dolphin-hacking. ADB client: dadb (Apache-2.0). Lyrics: LRCLIB. Font: Inter (OFL).",
                color = c.textLow,
                maxLines = 5,
            )
        }
        Spacer(Modifier.height(24.dp))
    }

    if (pickModel) {
        ListDialog(
            title = "Choose your car",
            options = BatteryPresets.all.map { it.model },
            onPick = { i ->
                val p = BatteryPresets.all[i]
                graph.settings.update { it.copy(carModel = p.model, cost = it.cost.copy(batteryCapacityKwh = p.capacityKwh)) }
                pickModel = false
            },
            onDismiss = { pickModel = false },
        )
    }
    if (pickVoice) {
        val voices by graph.voice.speaker.voices.collectAsState()
        ListDialog(
            title = "Choose the assistant's voice",
            options = listOf("Automatic (most British voice)") + voices.map { it.label },
            onPick = { i ->
                graph.settings.update { it.copy(voiceId = if (i == 0) "" else voices[i - 1].id) }
                pickVoice = false
                graph.voice.preview()
            },
            onDismiss = { pickVoice = false },
        )
    }
}

@Composable
private fun CheckRow(ok: Boolean, title: String, detail: String, onFix: (() -> Unit)? = null) {
    val c = Gd.colors
    Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
            if (ok) Icons.Rounded.CheckCircle else Icons.Rounded.ErrorOutline,
            contentDescription = if (ok) "Done" else "Needs setting up",
            tint = if (ok) c.mint else c.amber,
            modifier = Modifier.size(30.dp),
        )
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = c.text)
            Label(detail)
        }
        if (!ok && onFix != null) GdButton("Allow", onClick = onFix)
    }
}

@Composable
private fun TextSetting(label: String, value: String, enabled: Boolean, secret: Boolean = false, onCommit: (String) -> Unit) {
    var text by remember { mutableStateOf(value) }
    // Follow outside changes without fighting the keyboard.
    LaunchedEffect(value) { if (text != value) text = value }
    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it
            onCommit(it)
        },
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        textStyle = MaterialTheme.typography.bodyLarge,
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun NumberSetting(label: String, value: Double, enabled: Boolean, onCommit: (Double) -> Unit) {
    var text by remember { mutableStateOf(trimNumber(value)) }
    LaunchedEffect(value) { if (text.replace(',', '.').toDoubleOrNull() != value) text = trimNumber(value) }
    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it
            it.replace(',', '.').toDoubleOrNull()?.takeIf { v -> v >= 0 }?.let(onCommit)
        },
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        textStyle = MaterialTheme.typography.bodyLarge,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    )
}

private fun trimNumber(v: Double): String = if (v == Math.floor(v)) v.toLong().toString() else "%.2f".format(v).trimEnd('0').trimEnd('.')

@Composable
private fun ListDialog(title: String, options: List<String>, onPick: (Int) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                items(options.size) { i ->
                    Text(
                        options[i],
                        style = MaterialTheme.typography.bodyLarge,
                        color = Gd.colors.text,
                        modifier = Modifier.fillMaxWidth().clickable { onPick(i) }.padding(vertical = 16.dp),
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}
