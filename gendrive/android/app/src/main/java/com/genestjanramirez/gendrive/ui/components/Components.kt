@file:OptIn(ExperimentalFoundationApi::class)

package com.genestjanramirez.gendrive.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Apps
import androidx.compose.material.icons.rounded.FlashOn
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.core.vehicle.PressureUnit
import com.genestjanramirez.gendrive.core.vehicle.TyrePressures
import com.genestjanramirez.gendrive.core.vehicle.Units
import com.genestjanramirez.gendrive.ui.Fmt
import com.genestjanramirez.gendrive.ui.theme.Gd
import com.genestjanramirez.gendrive.voice.AssistantPhase
import com.genestjanramirez.gendrive.voice.AssistantUi

private val CardShape = RoundedCornerShape(28.dp)

/** The glass card every screen is built from. */
@Composable
fun GdCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    accent: Color? = null,
    contentPadding: PaddingValues = PaddingValues(22.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Gd.colors
    var m = modifier
        .clip(CardShape)
        .background(Brush.verticalGradient(listOf(c.cardTop, c.card)))
        .border(1.dp, accent?.copy(alpha = 0.6f) ?: c.border, CardShape)
    if (onClick != null || onLongClick != null) {
        m = m.combinedClickable(onClick = { onClick?.invoke() }, onLongClick = onLongClick)
    }
    Column(m.padding(contentPadding), content = content)
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, color: Color = Gd.colors.textMid, maxLines: Int = 2) {
    Text(text, modifier, color = color, style = MaterialTheme.typography.labelMedium, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier.padding(top = 8.dp, bottom = 10.dp), style = MaterialTheme.typography.titleMedium, color = Gd.colors.text)
}

@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    Row(
        modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.16f))
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, color = color, style = MaterialTheme.typography.labelLarge, maxLines = 1)
    }
}

/** Big, thumb-sized button. At least 72 dp tall so it can be hit without looking twice. */
@Composable
fun GdButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    primary: Boolean = false,
    enabled: Boolean = true,
) {
    val c = Gd.colors
    val shape = RoundedCornerShape(24.dp)
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.4f)
            .heightIn(min = 72.dp)
            .clip(shape)
            .background(if (primary) c.mint else c.cardTop)
            .border(1.dp, if (primary) Color.Transparent else c.border, shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = if (primary) c.onAccent else c.mint, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
        }
        Text(text, color = if (primary) c.onAccent else c.text, style = MaterialTheme.typography.labelLarge, maxLines = 2)
    }
}

@Composable
fun Tile(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = Gd.colors.mint,
    subtitle: String? = null,
    onLongClick: (() -> Unit)? = null,
) {
    GdCard(modifier.heightIn(min = 120.dp), onClick = onClick, onLongClick = onLongClick, contentPadding = PaddingValues(18.dp)) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(36.dp))
        Spacer(Modifier.size(10.dp))
        Text(label, style = MaterialTheme.typography.titleMedium, color = Gd.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (subtitle != null) Label(subtitle, maxLines = 1)
    }
}

@Composable
fun SettingSwitch(title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit, enabled: Boolean = true) {
    val c = Gd.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clip(RoundedCornerShape(20.dp))
            .clickable(enabled = enabled) { onChange(!checked) }
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = c.text)
            if (subtitle != null) Label(subtitle, maxLines = 3)
        }
        Spacer(Modifier.width(16.dp))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(checkedTrackColor = c.mint, checkedThumbColor = c.onAccent),
        )
    }
}

/** Battery state of charge as a 270° ring. Colour shifts to amber under 30 % and coral under 15 %. */
@Composable
fun BatteryRing(soc: Double?, charging: Boolean, diameter: Dp = 200.dp, caption: String? = null) {
    val c = Gd.colors
    val target = ((soc ?: 0.0) / 100.0).toFloat().coerceIn(0f, 1f)
    val sweep by animateFloatAsState(target, tween(900), label = "soc")
    val color = when {
        soc == null -> c.textLow
        soc < 15 -> c.coral
        soc < 30 -> c.amber
        else -> c.mint
    }
    Box(Modifier.size(diameter), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = diameter.toPx() * 0.075f
            val inset = Offset(stroke / 2, stroke / 2)
            val arcSize = Size(size.width - stroke, size.height - stroke)
            drawArc(c.border, 135f, 270f, false, inset, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            if (sweep > 0f) {
                drawArc(
                    brush = Brush.linearGradient(listOf(color.copy(alpha = 0.55f), color)),
                    startAngle = 135f,
                    sweepAngle = 270f * sweep,
                    useCenter = false,
                    topLeft = inset,
                    size = arcSize,
                    style = Stroke(stroke, cap = StrokeCap.Round),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    Fmt.int(soc),
                    color = c.text,
                    style = MaterialTheme.typography.headlineLarge.copy(fontSize = (diameter.value * 0.25f).sp, lineHeight = (diameter.value * 0.27f).sp),
                )
                Text("%", color = c.textMid, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 8.dp, start = 2.dp))
            }
            if (charging) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.FlashOn, contentDescription = null, tint = c.mint, modifier = Modifier.size(20.dp))
                    Label("Charging", color = c.mint)
                }
            } else if (caption != null) {
                Label(caption)
            }
        }
    }
}

/** P R N D with the current gear lit, like the car's own selector display. */
@Composable
fun GearStrip(gear: Gear, modifier: Modifier = Modifier) {
    val c = Gd.colors
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(Gear.P, Gear.R, Gear.N, Gear.D).forEach { g ->
            val on = g == gear || (g == Gear.D && (gear == Gear.S || gear == Gear.M))
            Box(
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (on) c.mint.copy(alpha = 0.18f) else Color.Transparent),
                contentAlignment = Alignment.Center,
            ) {
                Text(g.label, color = if (on) c.mint else c.textLow, style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

/** The assistant button. Pulses while listening (with the voice level), spins while thinking. */
@Composable
fun AssistantOrb(ui: AssistantUi, onClick: () -> Unit, diameter: Dp = 84.dp) {
    val c = Gd.colors
    val transition = rememberInfiniteTransition(label = "orb")
    val pulse by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart),
        label = "pulse",
    )
    val active = ui.phase != AssistantPhase.IDLE
    Box(Modifier.size(diameter + 28.dp), contentAlignment = Alignment.Center) {
        if (active) {
            Canvas(Modifier.fillMaxSize()) {
                val r = size.minDimension / 2
                drawCircle(c.violet.copy(alpha = (1f - pulse) * 0.45f), radius = r * (0.62f + 0.38f * pulse))
                if (ui.phase == AssistantPhase.LISTENING) {
                    drawCircle(c.violet.copy(alpha = 0.35f), radius = r * (0.66f + 0.34f * ui.level.coerceIn(0f, 1f)))
                }
            }
        }
        Box(
            Modifier
                .size(diameter)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(c.violet, c.blue)))
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            if (ui.phase == AssistantPhase.THINKING) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 4.dp, modifier = Modifier.size(diameter * 0.45f))
            } else {
                Icon(
                    if (ui.phase == AssistantPhase.LISTENING || ui.phase == AssistantPhase.SPEAKING) Icons.Rounded.GraphicEq else Icons.Rounded.Mic,
                    contentDescription = "Talk to the assistant",
                    tint = Color.White,
                    modifier = Modifier.size(diameter * 0.42f),
                )
            }
        }
    }
}

/** Top-down car with the four tyre pressures around it. */
@Composable
fun CarTopView(tyres: TyrePressures?, unit: PressureUnit, lowKpa: Double, modifier: Modifier = Modifier) {
    val c = Gd.colors
    Box(modifier) {
        Canvas(Modifier.fillMaxSize().padding(vertical = 12.dp)) {
            val w = size.width * 0.34f
            val h = size.height * 0.92f
            val left = (size.width - w) / 2
            val top = (size.height - h) / 2
            val radius = CornerRadius(w * 0.32f, w * 0.32f)
            // Wheels
            val wheelW = w * 0.14f
            val wheelH = h * 0.16f
            listOf(top + h * 0.13f, top + h * 0.70f).forEach { y ->
                drawRoundRect(c.textLow, Offset(left - wheelW * 0.55f, y), Size(wheelW, wheelH), CornerRadius(wheelW / 2, wheelW / 2))
                drawRoundRect(c.textLow, Offset(left + w - wheelW * 0.45f, y), Size(wheelW, wheelH), CornerRadius(wheelW / 2, wheelW / 2))
            }
            // Body
            drawRoundRect(Brush.verticalGradient(listOf(c.cardTop, c.border)), Offset(left, top), Size(w, h), radius)
            drawRoundRect(c.mint.copy(alpha = 0.55f), Offset(left, top), Size(w, h), radius, style = Stroke(3.dp.toPx()))
            // Windscreen, roof and rear window
            drawRoundRect(c.bg.copy(alpha = 0.85f), Offset(left + w * 0.12f, top + h * 0.22f), Size(w * 0.76f, h * 0.13f), CornerRadius(w * 0.12f, w * 0.12f))
            drawRoundRect(c.card, Offset(left + w * 0.14f, top + h * 0.37f), Size(w * 0.72f, h * 0.36f), CornerRadius(w * 0.1f, w * 0.1f))
            drawRoundRect(c.bg.copy(alpha = 0.85f), Offset(left + w * 0.14f, top + h * 0.75f), Size(w * 0.72f, h * 0.09f), CornerRadius(w * 0.1f, w * 0.1f))
        }
        TyreBubble("Front left", tyres?.frontLeftKpa, unit, lowKpa, Modifier.align(Alignment.TopStart))
        TyreBubble("Front right", tyres?.frontRightKpa, unit, lowKpa, Modifier.align(Alignment.TopEnd), alignEnd = true)
        TyreBubble("Rear left", tyres?.rearLeftKpa, unit, lowKpa, Modifier.align(Alignment.BottomStart))
        TyreBubble("Rear right", tyres?.rearRightKpa, unit, lowKpa, Modifier.align(Alignment.BottomEnd), alignEnd = true)
    }
}

@Composable
private fun TyreBubble(name: String, kpa: Double?, unit: PressureUnit, lowKpa: Double, modifier: Modifier, alignEnd: Boolean = false) {
    val c = Gd.colors
    val low = kpa != null && kpa < lowKpa
    Column(modifier.padding(8.dp), horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(Units.formatPressure(kpa, unit), style = MaterialTheme.typography.headlineMedium, color = if (low) c.amber else c.text)
            Text(" ${unit.label}", style = MaterialTheme.typography.bodySmall, color = c.textMid, modifier = Modifier.padding(bottom = 6.dp))
        }
        Label(if (low) "$name · low" else name, color = if (low) c.amber else c.textMid)
    }
}

@Composable
fun AppIcon(label: String, icon: ImageBitmap?, onClick: () -> Unit, modifier: Modifier = Modifier, onLongClick: (() -> Unit)? = null, badge: Boolean = false) {
    val c = Gd.colors
    Column(
        modifier
            .clip(RoundedCornerShape(24.dp))
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box {
            if (icon != null) {
                Image(icon, contentDescription = null, modifier = Modifier.size(72.dp))
            } else {
                Box(Modifier.size(72.dp).clip(RoundedCornerShape(20.dp)).background(c.cardTop), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.Apps, contentDescription = null, tint = c.textMid)
                }
            }
            if (badge) {
                Box(Modifier.size(18.dp).align(Alignment.TopEnd).clip(CircleShape).background(c.mint))
            }
        }
        Spacer(Modifier.size(8.dp))
        Text(label, style = MaterialTheme.typography.bodySmall, color = c.text, maxLines = 2, textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
    }
}
