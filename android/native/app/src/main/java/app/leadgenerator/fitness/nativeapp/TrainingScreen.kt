package app.leadgenerator.fitness.nativeapp

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.ceil

@Composable
internal fun TrainingScreen(
    state: JournalState,
    journal: Journal,
    sync: SyncState,
    busy: Boolean,
    error: String,
    restDeadline: Long,
    onResetRest: () -> Unit,
    onRefresh: () -> Unit,
    onSignIn: () -> Unit,
    onStart: (TrainingTemplate) -> Unit,
    onFinish: (Workout) -> Unit,
    onCancel: (Workout) -> Unit,
    onRecord: (Workout, Exercise, Double, Int) -> Unit,
    onHistory: (String) -> Unit,
    onCatalog: () -> Unit,
    onNewTemplate: () -> Unit,
    onFormats: () -> Unit,
    onLibrary: () -> Unit,
    onEditTemplate: (String) -> Unit,
) {
    val workout = journal.workout
    val pending = state.queue.count { it.entry.state == UploadState.Pending }
    val pendingHere = state.queue.any { it.workoutId == workout?.id && it.entry.state == UploadState.Pending }
    val failed = state.queue.filter { it.entry.state == UploadState.Failed }
    var confirm by remember(workout?.id) { mutableStateOf<SessionDecision?>(null) }

    VibeList {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                VibeHeading("Тренировки")
                IconButton(onClick = onRefresh, enabled = !busy && sync != SyncState.Syncing) {
                    Icon(Icons.Default.Refresh, "Синхронизировать")
                }
            }
            SyncStatus(sync, pending, onSignIn)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
        item { SettingsRow("Кардио и круговые", Icons.AutoMirrored.Default.ArrowForward, onFormats) }
        item { SettingsRow("Тренировочные программы", Icons.AutoMirrored.Default.ArrowForward, onLibrary) }
        if (failed.isNotEmpty()) {
            item {
                VibeCard {
                    Text("Подходы на телефоне", style = MaterialTheme.typography.titleMedium)
                    Text("Сервер не принял эти записи.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    failed.forEach { Text("${it.exerciseName} · ${displayWeight(it.entry.weight, journal.weightUnit)} × ${it.entry.reps}") }
                }
            }
        }
        if (workout == null) {
            item {
                VibeCard {
                    Text("Начать силовую", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        if (journal.templates.isEmpty()) "Здесь появятся сохранённые силовые шаблоны."
                        else "Выберите шаблон для тренировки.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    FilledTonalButton(onClick = onCatalog) { Text("Каталог упражнений") }
                    Button(onClick = onNewTemplate, enabled = !busy) { Text("Создать шаблон") }
                }
            }
            items(journal.templates, key = { "template-${it.id}" }) { template ->
                VibeCard {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(template.name, style = MaterialTheme.typography.titleMedium)
                            Text("Упражнений: ${template.exerciseCount}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { onStart(template) }, enabled = !busy && template.exerciseCount > 0) {
                            Icon(Icons.Default.Add, "Начать тренировку ${template.name}")
                        }
                    }
                    TextButton(onClick = { onEditTemplate(template.id) }, enabled = !busy) { Text("Редактировать шаблон") }
                }
            }
        } else {
            item {
                VibeCard {
                    Text(workout.name, style = MaterialTheme.typography.headlineMedium)
                    val setCount = workout.exercises.sumOf { state.entries(workout, it).size }
                    Text("Упражнений: ${workout.exercises.size} · Подходов: $setCount", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (restDeadline > 0) RestClock(restDeadline, onResetRest)
                }
            }
            items(workout.exercises, key = { "${workout.id}-${it.id}" }) { exercise ->
                ExerciseEntryCard(state.entries(workout, exercise), exercise, journal.weightUnit, busy) { weight, reps ->
                    onRecord(workout, exercise, weight, reps)
                }
            }
            item {
                Button(
                    onClick = { confirm = SessionDecision.Finish }, enabled = !busy && !pendingHere,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                ) { Text("Завершить тренировку") }
                if (pendingHere) {
                    Text("Синхронизируйте подходы перед завершением.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                TextButton(onClick = { confirm = SessionDecision.Cancel }, enabled = !busy && !pendingHere) {
                    Text("Отменить тренировку")
                }
            }
        }
        if (journal.recent.isNotEmpty()) {
            item { Text("История", style = MaterialTheme.typography.headlineMedium) }
            items(journal.recent, key = { "recent-${it.id}" }) { recent ->
                HistoryRow(recent) { onHistory(recent.id) }
            }
        }
    }
    val decision = confirm
    if (workout != null && decision != null) {
        val finish = decision == SessionDecision.Finish
        AlertDialog(
            onDismissRequest = { confirm = null },
            title = { Text(if (finish) "Завершить тренировку?" else "Отменить тренировку?") },
            text = { Text(if (finish) "Тренировка появится в истории." else "Тренировка будет отмечена как отменённая.") },
            confirmButton = {
                TextButton(onClick = { confirm = null; if (finish) onFinish(workout) else onCancel(workout) }) {
                    Text(if (finish) "Завершить" else "Отменить тренировку")
                }
            },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text("Назад") } },
        )
    }
}

private enum class SessionDecision { Finish, Cancel }

@Composable
internal fun HistoryRow(recent: RecentWorkout, onClick: () -> Unit) {
    Surface(
        onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text(recent.name, style = MaterialTheme.typography.titleMedium)
                Text("${formatWorkoutDate(recent.startedAt)} · Подходов: ${recent.setCount}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.AutoMirrored.Default.ArrowForward, null, tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
internal fun SyncStatus(sync: SyncState, pending: Int, onSignIn: () -> Unit) {
    val text = when {
        sync == SyncState.Syncing -> "Синхронизация…"
        pending > 0 -> "Ожидают отправки: $pending"
        sync == SyncState.WaitingForNetwork -> "Сервер недоступен"
        else -> null
    }
    if (text != null) Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (sync == SyncState.SignIn) TextButton(onClick = onSignIn) { Text("Войти для синхронизации") }
}

@Composable
private fun ExerciseEntryCard(entries: List<SetEntry>, exercise: Exercise, unit: String, busy: Boolean, onSave: (Double, Int) -> Unit) {
    var weight by rememberSaveable(unit) {
        mutableStateOf(entries.lastOrNull()?.weight?.let { value ->
            formatNumber(weightToDisplay(value, unit), 3).filter { it.isDigit() || it == ',' }
        }.orEmpty())
    }
    var reps by rememberSaveable { mutableStateOf(entries.lastOrNull()?.reps?.toString().orEmpty()) }
    val enteredWeight = weight.replace(',', '.').toDoubleOrNull()?.let { weightToKilos(it, unit) }?.takeIf { it in 0.0..1000.0 }
    val enteredReps = reps.toIntOrNull()?.takeIf { it in 1..100 }
    VibeCard {
        Text(exercise.name, style = MaterialTheme.typography.titleLarge)
        if (entries.isNotEmpty()) {
            entries.forEachIndexed { index, set ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${index + 1}.  ${displayWeight(set.weight, unit)} × ${set.reps}")
                    val status = when (set.state) {
                        UploadState.Pending -> "На телефоне"
                        UploadState.Failed -> "Не отправлен"
                        UploadState.Sent -> null
                    }
                    if (status != null) Text(status, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            HorizontalDivider()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                weight, { weight = it.take(8) }, Modifier.weight(1f), label = { Text("Вес, ${weightUnitLabel(unit)}") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            )
            OutlinedTextField(
                reps, { reps = it.take(3) }, Modifier.weight(1f), label = { Text("Повторы") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        }
        Button(
            onClick = { if (enteredWeight != null && enteredReps != null) onSave(enteredWeight, enteredReps) },
            enabled = !busy && enteredWeight != null && enteredReps != null,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text("Записать подход") }
    }
}

@Composable
private fun RestClock(deadline: Long, onReset: () -> Unit) {
    var remaining by remember(deadline) { mutableIntStateOf(secondsRemaining(deadline)) }
    LaunchedEffect(deadline) {
        while (remaining > 0) {
            delay(250)
            remaining = secondsRemaining(deadline)
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        val minutes = remaining / 60
        val seconds = (remaining % 60).toString().padStart(2, '0')
        Text(if (remaining > 0) "Отдых · $minutes:$seconds" else "Отдых завершён", color = MaterialTheme.colorScheme.primary)
        TextButton(onClick = onReset) { Text(if (remaining > 0) "Остановить" else "Закрыть") }
    }
}

private fun secondsRemaining(deadline: Long) = ceil((deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0) / 1000.0).toInt()
