package com.genestjanramirez.gendrive.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.genestjanramirez.gendrive.AppGraph
import com.genestjanramirez.gendrive.core.trip.EnergyMath
import com.genestjanramirez.gendrive.core.trip.TripStats
import com.genestjanramirez.gendrive.ui.Fmt
import com.genestjanramirez.gendrive.ui.components.GdCard
import com.genestjanramirez.gendrive.ui.components.Label
import com.genestjanramirez.gendrive.ui.components.Pill
import com.genestjanramirez.gendrive.ui.components.SectionTitle
import com.genestjanramirez.gendrive.ui.theme.Gd
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun TripsScreen(graph: AppGraph) {
    val c = Gd.colors
    val context = LocalContext.current
    val trips by graph.trips.trips.collectAsState()
    val charges by graph.trips.charges.collectAsState()
    val settings by graph.settings.state.collectAsState()
    var period by rememberSaveable { mutableIntStateOf(0) }
    var showCharging by rememberSaveable { mutableIntStateOf(0) }
    val day = 24L * 3_600_000
    val now = System.currentTimeMillis()
    val from = when (period) {
        0 -> now - 7 * day
        1 -> now - 30 * day
        else -> 0L
    }
    val shown = TripStats.since(trips, from)
    val summary = TripStats.summarise(shown, settings.cost)
    val change = TripStats.weekOverWeekChangePct(trips, now)
    val cur = settings.cost.currency

    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Segmented(listOf("7 days", "30 days", "All"), period) { period = it }
                Spacer(Modifier.width(16.dp))
                Segmented(listOf("Trips", "Charging"), showCharging) { showCharging = it }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Summary("Distance", Fmt.distance(summary.distanceKm, settings.distanceUnit), Modifier.weight(1f))
                Summary("Average", summary.consumptionKwhPer100?.let { "${Fmt.one(it)} kWh/100 km" } ?: Fmt.DASH, Modifier.weight(1f))
                Summary("Electricity", Fmt.money(summary.electricityCost, cur), Modifier.weight(1f))
                Summary("Saved vs petrol", Fmt.money(summary.saved.coerceAtLeast(0.0), cur), Modifier.weight(1f), c.mint)
            }
        }
        if (change != null) {
            item {
                val better = change < 0
                Label(
                    if (better) "This week you used ${abs(change).roundToInt()}% less energy per km than last week. Keep it up."
                    else "This week used ${change.roundToInt()}% more energy per km than last week. Gentle starts and steady speeds help.",
                    color = if (better) c.mint else c.amber,
                )
            }
        }
        if (showCharging == 0) {
            item { SectionTitle("Trips") }
            if (shown.isEmpty()) item { Label("No trips yet. GenDrive logs each drive automatically while it's running.") }
            items(shown, key = { it.id }) { t ->
                GdCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(Fmt.dayAndTime(context, t.startMs), style = MaterialTheme.typography.titleMedium, color = c.text)
                            val parts = listOfNotNull(
                                Fmt.distance(t.distanceKm, settings.distanceUnit),
                                Fmt.duration(t.durationMs),
                                t.consumptionKwhPer100()?.let { "${Fmt.one(it)} kWh/100 km" },
                                if (t.startSoc != null && t.endSoc != null) "${Fmt.int(t.startSoc)}% → ${Fmt.int(t.endSoc)}%" else null,
                            )
                            Label(parts.joinToString("  ·  "))
                        }
                        if (t.demo) Pill("Demo", c.amber)
                        Spacer(Modifier.width(12.dp))
                        t.energyKwh?.let { kwh ->
                            Text(
                                Fmt.money(EnergyMath.electricityCost(kwh, settings.cost.pricePerKwh, settings.cost.chargingLossPct), cur),
                                style = MaterialTheme.typography.titleMedium,
                                color = c.text,
                            )
                        }
                    }
                }
            }
            if (trips.any { it.demo }) {
                item { TextButton(onClick = { graph.trips.clearDemoTrips() }) { Text("Remove demo trips", color = c.amber) } }
            }
        } else {
            item { SectionTitle("Charging sessions") }
            val shownCharges = charges.filter { it.startMs >= from }
            if (shownCharges.isEmpty()) item { Label("No charging sessions yet.") }
            items(shownCharges, key = { it.id }) { s ->
                GdCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(Fmt.dayAndTime(context, s.startMs), style = MaterialTheme.typography.titleMedium, color = c.text)
                            val parts = listOfNotNull(
                                "${Fmt.one(s.energyKwh)} kWh",
                                Fmt.duration(s.endMs - s.startMs),
                                if (s.startSoc != null && s.endSoc != null) "${Fmt.int(s.startSoc)}% → ${Fmt.int(s.endSoc)}%" else null,
                                "up to ${Fmt.one(s.maxPowerKw)} kW",
                            )
                            Label(parts.joinToString("  ·  "))
                        }
                        Pill(if (s.isDcFast) "DC fast" else "AC", if (s.isDcFast) c.blue else c.mint)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            Fmt.money(EnergyMath.electricityCost(s.energyKwh, settings.cost.pricePerKwh, settings.cost.chargingLossPct), cur),
                            style = MaterialTheme.typography.titleMedium,
                            color = c.text,
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun Summary(label: String, value: String, modifier: Modifier, color: Color = Gd.colors.text) {
    GdCard(modifier) {
        Label(label, maxLines = 1)
        Text(value, style = MaterialTheme.typography.titleLarge, color = color, maxLines = 1)
    }
}
