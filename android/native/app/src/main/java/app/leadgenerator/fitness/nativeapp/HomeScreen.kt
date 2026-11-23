package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.List
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
internal fun HomeScreen(
    journal: Journal,
    onTraining: () -> Unit,
    onProgress: () -> Unit,
    onCatalog: () -> Unit,
    onHistory: (String) -> Unit,
    onBody: () -> Unit,
) {
    val today = LocalDate.now()
    val counts = journal.recent.mapNotNull { workoutDate(it.startedAt) }.groupingBy { it }.eachCount()
    val week = (6L downTo 0L).map { today.minusDays(it) }
    val weeklyCount = week.sumOf { counts[it] ?: 0 }
    val workout = journal.workout
    VibeList {
        item { VibeHeading("Сегодня", today.format(DateTimeFormatter.ofPattern("EEEE, d MMMM", RussianLocale))) }
        item {
            val colors = MaterialTheme.colorScheme
            Surface(shape = MaterialTheme.shapes.large, color = colors.primary, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        if (workout == null) "Время тренироваться" else workout.name,
                        style = MaterialTheme.typography.headlineMedium,
                        color = colors.onPrimary,
                    )
                    Text(
                        if (workout != null) "Упражнений: ${workout.exercises.size}"
                        else if (journal.templates.isNotEmpty()) "Готовых шаблонов: ${journal.templates.size}"
                        else "Откройте дневник и выберите тренировку.",
                        color = colors.onPrimary,
                    )
                    Button(
                        onClick = onTraining, modifier = Modifier.heightIn(min = 48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = colors.onPrimary, contentColor = colors.primary),
                    ) { Text(if (workout == null) "Открыть тренировки" else "Продолжить") }
                }
            }
        }
        item {
            VibeCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("За 7 дней", style = MaterialTheme.typography.titleMedium)
                        Text(formatNumber(weeklyCount), style = MaterialTheme.typography.headlineMedium)
                        Text("Завершённые силовые", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = onProgress) { Text("Прогресс") }
                }
                WeeklyBars(week.map { counts[it] ?: 0 })
                val dayLabel = DateTimeFormatter.ofPattern("EE", RussianLocale)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    week.forEach { Text(it.format(dayLabel), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SettingsRow("Каталог упражнений", Icons.Default.List, onCatalog)
                SettingsRow("Прогресс и самочувствие", Icons.Default.Favorite, onProgress)
                SettingsRow("Модель тела и мышцы", Icons.Default.Favorite, onBody)
                SettingsRow("История тренировок", Icons.Default.DateRange, onTraining)
            }
        }
        val recent = journal.recent.firstOrNull()
        if (recent != null) {
            item { Text("Последняя тренировка", style = MaterialTheme.typography.headlineSmall) }
            item { HistoryRow(recent) { onHistory(recent.id) } }
        }
    }
}

@Composable
private fun WeeklyBars(counts: List<Int>) {
    val accent = MaterialTheme.colorScheme.primary
    val base = MaterialTheme.colorScheme.surfaceVariant
    val maxCount = (counts.maxOrNull() ?: 0).coerceAtLeast(1)
    Canvas(Modifier.fillMaxWidth().height(42.dp)) {
        val slot = size.width / counts.size
        val width = (slot * 0.34f).coerceAtMost(20.dp.toPx())
        counts.forEachIndexed { index, count ->
            val height = (size.height * count / maxCount).coerceAtLeast(4.dp.toPx())
            drawRoundRect(
                color = if (count == 0) base else accent,
                topLeft = Offset(index * slot + (slot - width) / 2, size.height - height),
                size = Size(width, height),
                cornerRadius = CornerRadius(width / 2),
            )
        }
    }
}

@Composable
internal fun SettingsRow(title: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(
        onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
                Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                    Icon(icon, null, modifier = Modifier.size(19.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
                }
            }
            Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Icon(Icons.AutoMirrored.Default.ArrowForward, null, modifier = Modifier.size(19.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
