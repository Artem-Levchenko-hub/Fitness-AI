package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val LightColors = lightColorScheme(
    primary = Color(0xff294b38), onPrimary = Color(0xfffcfbf4),
    primaryContainer = Color(0xffdcebd9), onPrimaryContainer = Color(0xff173c29),
    secondary = Color(0xff586653), secondaryContainer = Color(0xffe5ebe0),
    tertiary = Color(0xff8a533e), tertiaryContainer = Color(0xfff7e3d5),
    background = Color(0xfff7f5ee), onBackground = Color(0xff222720),
    surface = Color(0xfffefdf8), onSurface = Color(0xff222720),
    surfaceVariant = Color(0xffe7e9df), onSurfaceVariant = Color(0xff515b50),
    surfaceContainerLow = Color(0xfffaf8f1), surfaceContainer = Color(0xfff1efe6),
    surfaceContainerHigh = Color(0xffebe9df), outline = Color(0xff778173),
    outlineVariant = Color(0xffd9ddd1), error = Color(0xffa13f33),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xffb2d6b5), onPrimary = Color(0xff183722),
    primaryContainer = Color(0xff294637), onPrimaryContainer = Color(0xffd5eed5),
    secondary = Color(0xffbfcdb7), secondaryContainer = Color(0xff343f35),
    tertiary = Color(0xffe4b098), tertiaryContainer = Color(0xff56382e),
    background = Color(0xff191d18), onBackground = Color(0xffedece4),
    surface = Color(0xff232921), onSurface = Color(0xffedece4),
    surfaceVariant = Color(0xff3f493e), onSurfaceVariant = Color(0xffc1ccbd),
    surfaceContainerLow = Color(0xff20251f), surfaceContainer = Color(0xff262d25),
    surfaceContainerHigh = Color(0xff2e362c), outline = Color(0xff8b9988),
    outlineVariant = Color(0xff465144), error = Color(0xfff2aa9c),
)

private val Defaults = Typography()
private val VibeTypography = Defaults.copy(
    headlineLarge = Defaults.headlineLarge.copy(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 39.sp),
    headlineMedium = Defaults.headlineMedium.copy(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 29.sp, lineHeight = 35.sp),
    headlineSmall = Defaults.headlineSmall.copy(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold),
    titleMedium = Defaults.titleMedium.copy(fontWeight = FontWeight.SemiBold),
)

@Composable
internal fun VibeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = VibeTypography,
        shapes = Shapes(medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(24.dp)),
        content = content,
    )
}

@Composable
internal fun VibeList(content: LazyListScope.() -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            Modifier.widthIn(max = 640.dp).fillMaxSize(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            content = content,
        )
    }
}

@Composable
internal fun VibeCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
internal fun VibeHeading(title: String, description: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge)
        if (description != null) {
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

internal val RussianLocale: Locale = Locale.forLanguageTag("ru")
internal fun formatNumber(value: Number, precision: Int = 2): String = NumberFormat.getNumberInstance(RussianLocale)
    .apply { maximumFractionDigits = precision }.format(value)

private const val KilosPerPound = 0.45359237
internal fun weightUnitLabel(unit: String) = if (unit == "lb") "фунт" else "кг"
internal fun weightToDisplay(kg: Double, unit: String) = if (unit == "lb") kg / KilosPerPound else kg
internal fun weightToKilos(value: Double, unit: String) = if (unit == "lb") value * KilosPerPound else value
internal fun displayWeight(kg: Double, unit: String) = "${formatNumber(weightToDisplay(kg, unit))} ${weightUnitLabel(unit)}"

internal fun workoutDate(value: String): LocalDate? = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate()
}.getOrNull()

internal fun formatWorkoutDate(date: String): String = workoutDate(date)
    ?.format(DateTimeFormatter.ofPattern("d MMM yyyy", RussianLocale)).orEmpty()
