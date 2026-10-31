package com.genestjanramirez.gendrive.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BatteryChargingFull
import androidx.compose.material.icons.rounded.FlashOn
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.ui.Fmt
import com.genestjanramirez.gendrive.ui.components.BatteryRing
import com.genestjanramirez.gendrive.ui.components.CarTopView
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.Pill
import com.genestjanramirez.gendrive.ui.theme.Gd

@Composable
fun CarScreen(graph: AppGraph) {
    val c = Gd.colors
    val state by graph.vehicle.state.collectAsState()
    val settings by graph.settings.state.collectAsState()
    val tyresLow = state.tyres?.anyBelow(settings.lowTyreKpa) == true

    val tyresCard: @Composable (Modifier) -> Unit = { m ->
        GdCard(m) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Tyres", style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
                when {
                    state.tyres == null -> Pill("No reading", c.textMid)
                    tyresLow -> Pill("Check pressure", c.amber)
                    else -> Pill("All good", c.mint)
                }
            }
            CarTopView(state.tyres, settings.pressureUnit, settings.lowTyreKpa, Modifier.fillMaxWidth().weight(1f))
        }
    }
    val detailCards: @Composable (Modifier) -> Unit = { m ->
        Column(m, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            GdCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BatteryRing(state.socPercent, state.isCharging, diameter = 160.dp)
                    Spacer(Modifier.width(24.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Stat(Icons.Rounded.Speed, "Range", state.rangeKm?.let { Fmt.distance(it.toDouble(), settings.distanceUnit) } ?: Fmt.DASH)
                        Stat(Icons.Rounded.BatteryChargingFull, "Battery temperature", state.batteryTempC?.let { "${Fmt.int(it)}°C" } ?: Fmt.DASH)
                        Stat(Icons.Rounded.FlashOn, "Last 50 km", state.consumptionKwhPer100Km?.let { "${Fmt.one(it)} kWh/100 km" } ?: Fmt.DASH)
                    }
                }
            }
            GdCard(Modifier.fillMaxWidth()) {
                Text("Charging", style = MaterialTheme.typography.titleMedium, color = c.text)
                Spacer(Modifier.height(10.dp))
                val status = when {
                    state.isCharging -> "Charging at ${Fmt.one(state.chargePowerKw)} kW" +
                        (state.chargeMinutesLeft?.let { " · full in ${Fmt.duration(it * 60_000L)}" } ?: "")
                    state.pluggedIn == true -> "Plugged in, not charging"
                    else -> "Not plugged in"
                }
                Text(status, style = MaterialTheme.typography.bodyLarge, color = if (state.isCharging) c.mint else c.textMid)
            }
            GdCard(Modifier.fillMaxWidth()) {
                Stat(Icons.Rounded.WbSunny, "Outside", state.outsideTempC?.let { "${Fmt.int(it)}°C" } ?: Fmt.DASH)
                Spacer(Modifier.height(10.dp))
                Stat(Icons.Rounded.BatteryChargingFull, "12 V battery", state.auxBatteryVolts?.let { "${Fmt.one(it)} V" } ?: Fmt.DASH)
                Spacer(Modifier.height(10.dp))
                Stat(Icons.Rounded.Speed, "Odometer", state.odometerKm?.let { Fmt.distance(it, settings.distanceUnit) } ?: Fmt.DASH)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Info, contentDescription = null, tint = c.textLow, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Label("Read only. GenDrive never changes how the car drives.", color = c.textLow)
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        if (maxWidth > maxHeight) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                tyresCard(Modifier.weight(1f).fillMaxSize())
                detailCards(Modifier.weight(1f).verticalScroll(rememberScrollState()))
            }
        } else {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                tyresCard(Modifier.fillMaxWidth().height(460.dp))
                detailCards(Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun Stat(icon: ImageVector, label: String, value: String) {
    val c = Gd.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = c.mint, modifier = Modifier.size(26.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Label(label)
            Text(value, style = MaterialTheme.typography.titleMedium, color = c.text)
        }
    }
}
