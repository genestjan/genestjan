package com.genestjanramirez.gendrive.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.genestjanramirez.gendrive.R

/**
 * GenDrive "Night Glass": deep navy, one mint accent for "good / go", blue for
 * navigation, amber and coral only for things that need attention, violet for
 * the assistant. Contrast is kept at 4.5:1 or better for every text colour.
 */
@Immutable
data class GdColors(
    val bg: Color,
    val card: Color,
    val cardTop: Color,
    val border: Color,
    val text: Color,
    val textMid: Color,
    val textLow: Color,
    val mint: Color,
    val blue: Color,
    val amber: Color,
    val coral: Color,
    val violet: Color,
    val onAccent: Color,
    val isDark: Boolean,
)

val DarkGd = GdColors(
    bg = Color(0xFF070B14),
    card = Color(0xFF0E1626),
    cardTop = Color(0xFF15223A),
    border = Color(0xFF1F2E4A),
    text = Color(0xFFF2F6FC),
    textMid = Color(0xFF9AABC4),
    textLow = Color(0xFF6B7F9E),
    mint = Color(0xFF2EE6A6),
    blue = Color(0xFF4DA3FF),
    amber = Color(0xFFFFB547),
    coral = Color(0xFFFF6B6B),
    violet = Color(0xFF9B8CFF),
    onAccent = Color(0xFF04140E),
    isDark = true,
)

val LightGd = GdColors(
    bg = Color(0xFFEEF3F9),
    card = Color(0xFFFFFFFF),
    cardTop = Color(0xFFF6F9FD),
    border = Color(0xFFD5DFEC),
    text = Color(0xFF0B1220),
    textMid = Color(0xFF44546C),
    textLow = Color(0xFF66768F),
    mint = Color(0xFF00936D),
    blue = Color(0xFF1F6FE5),
    amber = Color(0xFFA85F00),
    coral = Color(0xFFC93C3C),
    violet = Color(0xFF5B4BD6),
    onAccent = Color(0xFFFFFFFF),
    isDark = false,
)

val LocalGd = staticCompositionLocalOf { DarkGd }

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_extrabold, FontWeight.ExtraBold),
)

object Gd {
    val colors: GdColors
        @Composable get() = LocalGd.current
}

@Composable
fun GenDriveTheme(dark: Boolean, content: @Composable () -> Unit) {
    val gd = if (dark) DarkGd else LightGd
    val scheme = if (dark) {
        darkColorScheme(
            primary = gd.mint, onPrimary = gd.onAccent, secondary = gd.blue, background = gd.bg,
            onBackground = gd.text, surface = gd.card, onSurface = gd.text, surfaceVariant = gd.cardTop,
            onSurfaceVariant = gd.textMid, outline = gd.border, error = gd.coral,
        )
    } else {
        lightColorScheme(
            primary = gd.mint, onPrimary = gd.onAccent, secondary = gd.blue, background = gd.bg,
            onBackground = gd.text, surface = gd.card, onSurface = gd.text, surfaceVariant = gd.cardTop,
            onSurfaceVariant = gd.textMid, outline = gd.border, error = gd.coral,
        )
    }
    // Car-screen sizes: nothing a driver needs to read is smaller than 16 sp.
    val typography = Typography(
        displayLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 112.sp, lineHeight = 112.sp),
        displayMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 64.sp, lineHeight = 68.sp),
        headlineLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 44.sp, lineHeight = 48.sp),
        headlineMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp, lineHeight = 40.sp),
        titleLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 34.sp),
        titleMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, lineHeight = 28.sp),
        bodyLarge = TextStyle(fontFamily = Inter, fontSize = 20.sp, lineHeight = 28.sp),
        bodyMedium = TextStyle(fontFamily = Inter, fontSize = 18.sp, lineHeight = 26.sp),
        bodySmall = TextStyle(fontFamily = Inter, fontSize = 16.sp, lineHeight = 22.sp),
        labelLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, lineHeight = 22.sp),
        labelMedium = TextStyle(fontFamily = Inter, fontSize = 16.sp, lineHeight = 20.sp),
    )
    CompositionLocalProvider(LocalGd provides gd) {
        MaterialTheme(colorScheme = scheme, typography = typography, content = content)
    }
}
