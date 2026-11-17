package app.leadgenerator.fitness.nativeapp

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.json.JSONObject
import kotlin.math.round

internal fun LazyListScope.formatWorkoutDetails(
    kind: TrainingFormat,
    data: JSONObject,
    busy: Boolean,
    weightUnit: String,
    onWrite: (JSONObject) -> Unit,
) {
    val workout = data.getJSONObject("workout")
    val status = workout.optString("status")
    val activeId = workout.getString("id").takeIf { status == "active" }
    item {
        VibeHeading(
            workout.optString("name"),
            listOf(formatWorkoutDate(workout.optString("startedAt")), formatStatus(status))
                .filter { it.isNotBlank() }.joinToString(" · "),
        )
    }
    workout.formatText("notes")?.let { notes -> item { VibeCard { Text(notes) } } }
    when (kind) {
        TrainingFormat.Cardio -> cardioDetails(data.objects("blocks"), activeId, busy, onWrite)
        TrainingFormat.Circuit -> circuitDetails(workout, data, weightUnit, activeId, busy, onWrite)
    }
}

private fun LazyListScope.cardioDetails(
    blocks: List<JSONObject>,
    activeId: String?,
    busy: Boolean,
    onWrite: (JSONObject) -> Unit,
) {
    val next = blocks.firstOrNull { it.formatText("completedAt") == null }
    val done = blocks.count { it.formatText("completedAt") != null }
    item {
        Text("Записано $done из ${blocks.size} интервалов", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (activeId != null && next != null) {
        item(key = "current-${next.getString("id")}") { CardioBlockForm(next, busy, onWrite) }
    }
    if (activeId != null) item { FormatSessionActions(activeId, busy, onWrite) }
    if (blocks.isNotEmpty()) item { Text("Интервалы", style = MaterialTheme.typography.titleLarge) }
    items(blocks, key = { it.getString("id") }) { block ->
        VibeCard {
            Text(block.getString("label"), style = MaterialTheme.typography.titleMedium)
            val metrics = buildList {
                add("План ${formatsDuration(block.getInt("plannedDurationSec"))}")
                block.formatNumberOrNull("actualDurationSec")?.let { add("Факт ${formatsDuration(it.toInt())}") }
                block.formatNumberOrNull("hrAvg")?.let { add("Пульс ${it.toInt()} уд/мин") }
                block.formatNumberOrNull("rpe")?.let { add("RPE ${formatNumber(it)}") }
            }
            Text(metrics.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant)
            block.formatText("notes")?.let { Text(it) }
        }
    }
}

@Composable
private fun CardioBlockForm(block: JSONObject, busy: Boolean, onWrite: (JSONObject) -> Unit) {
    val planned = block.getInt("plannedDurationSec")
    var actual by rememberSaveable { mutableStateOf(planned.toString()) }
    var pulse by rememberSaveable { mutableStateOf("") }
    var effort by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    val actualSeconds = actual.formatInt(0..3600)
    val heartRate = pulse.formatInt(30..240)
    val rpe = effort.formatDecimal(1.0..10.0)
    val valid = actualSeconds != null && (pulse.isBlank() || heartRate != null) && (effort.isBlank() || rpe != null)
    VibeCard {
        Text(block.getString("label"), style = MaterialTheme.typography.titleLarge)
        FormatTimer(planned, !busy) { actual = it.toString() }
        FormatField(actual, { actual = it }, "Фактическое время, с", !busy, KeyboardType.Number)
        if (block.optString("kind") == "work") {
            FormatField(pulse, { pulse = it }, "Средний пульс, уд/мин", !busy, KeyboardType.Number)
            FormatField(effort, { effort = it }, "Нагрузка RPE (1–10)", !busy, KeyboardType.Decimal)
        }
        FormatField(notes, { notes = it.take(500) }, "Заметка", !busy, singleLine = false)
        Button(
            enabled = !busy && valid,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                onWrite(JSONObject().put("action", "log").put("blockId", block.getString("id"))
                    .put("actualDurationSec", actualSeconds).put("hrAvg", heartRate).put("rpe", rpe)
                    .put("notes", notes.trim().takeIf { it.isNotEmpty() }))
            },
        ) { Text("Записать интервал") }
    }
}

private data class CircuitSlot(val round: Int, val exerciseIndex: Int, val exercise: JSONObject)

private fun LazyListScope.circuitDetails(
    workout: JSONObject,
    data: JSONObject,
    weightUnit: String,
    activeId: String?,
    busy: Boolean,
    onWrite: (JSONObject) -> Unit,
) {
    val rounds = workout.optInt("totalRounds")
    val exercises = data.objects("exercises")
    val logs = data.objects("logs")
    val logged = logs.associateBy { it.getInt("roundNumber") to it.getString("circuitExerciseId") }
    val next = if (activeId != null) (1..rounds).firstNotNullOfOrNull { round ->
        val index = exercises.indexOfFirst { (round to it.getString("id")) !in logged }
        if (index == -1) null else CircuitSlot(round, index, exercises[index])
    } else null
    item {
        Text("$rounds круг. · ${exercises.size} упр.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (next != null) {
        val rest = when {
            next.exerciseIndex > 0 -> workout.optInt("restBetweenExercisesSec")
            next.round > 1 -> workout.optInt("restBetweenRoundsSec")
            else -> 0
        }
        item(key = "current-${next.round}-${next.exercise.getString("id")}") {
            CircuitRoundForm(next, rounds, rest, weightUnit, busy, onWrite)
        }
    }
    if (activeId != null) item { FormatSessionActions(activeId, busy, onWrite) }
    if (exercises.isNotEmpty()) item { Text("План круга", style = MaterialTheme.typography.titleLarge) }
    items(exercises, key = { it.getString("id") }) { exercise ->
        VibeCard {
            Text(exercise.getString("exerciseNameRu"), style = MaterialTheme.typography.titleMedium)
            val target = if (exercise.optString("kind") == "duration") {
                formatsDuration(exercise.optInt("targetDurationSec"))
            } else {
                "${exercise.optInt("targetReps")} повт."
            }
            val weight = exercise.formatNumberOrNull("targetWeightKg")?.toDouble()
            Text(listOfNotNull(target, weight?.let { displayWeight(it, weightUnit) }).joinToString(" · "))
            exercise.formatText("notes")?.let { Text(it) }
        }
    }
    val exercisesById = exercises.associateBy { it.getString("id") }
    val recordedRounds = logs.groupBy { it.getInt("roundNumber") }.toSortedMap().entries.toList()
    if (recordedRounds.isNotEmpty()) item { Text("Результаты", style = MaterialTheme.typography.titleLarge) }
    items(recordedRounds, key = { "round-${it.key}" }) { (round, entries) ->
        VibeCard {
            Text("Круг $round", style = MaterialTheme.typography.titleMedium)
            entries.sortedBy { exercisesById[it.getString("circuitExerciseId")]?.optInt("orderIdx") ?: Int.MAX_VALUE }
                .forEach { entry ->
                    val title = exercisesById[entry.getString("circuitExerciseId")]?.getString("exerciseNameRu")
                        ?: "Упражнение"
                    val values = buildList {
                        if (entry.optBoolean("skipped")) {
                            add("Пропущено")
                        } else {
                            entry.formatNumberOrNull("actualReps")?.let { add("${it.toInt()} повт.") }
                            entry.formatNumberOrNull("actualDurationSec")?.let { add(formatsDuration(it.toInt())) }
                            entry.formatNumberOrNull("actualWeightKg")?.let { add(displayWeight(it.toDouble(), weightUnit)) }
                            entry.formatNumberOrNull("rpe")?.let { add("RPE ${formatNumber(it)}") }
                            if (isEmpty()) add("Выполнено")
                        }
                    }
                    Text((listOf(title) + values).joinToString(" · "))
                }
        }
    }
}

@Composable
private fun CircuitRoundForm(
    slot: CircuitSlot,
    totalRounds: Int,
    rest: Int,
    weightUnit: String,
    busy: Boolean,
    onWrite: (JSONObject) -> Unit,
) {
    val exercise = slot.exercise
    val byTime = exercise.optString("kind") == "duration"
    val target = exercise.optInt(if (byTime) "targetDurationSec" else "targetReps")
    var actual by rememberSaveable { mutableStateOf(target.toString()) }
    var weight by rememberSaveable(weightUnit) {
        mutableStateOf(exercise.formatNumberOrNull("targetWeightKg")?.toDouble()?.let {
            (round(weightToDisplay(it, weightUnit) * 100) / 100).toString()
        }.orEmpty())
    }
    var effort by rememberSaveable { mutableStateOf("") }
    val result = actual.formatInt(if (byTime) 0..3600 else 0..500)
    val kilos = weight.formatWeight(weightUnit)
    val rpe = effort.formatDecimal(1.0..10.0)
    val valid = result != null && (weight.isBlank() || kilos != null) && (effort.isBlank() || rpe != null)

    fun mark(skipped: Boolean) {
        val body = JSONObject().put("action", "log").put("circuitExerciseId", exercise.getString("id"))
            .put("roundNumber", slot.round).put("skipped", skipped)
        if (!skipped) {
            body.put(if (byTime) "actualDurationSec" else "actualReps", result)
                .put("actualWeightKg", kilos).put("rpe", rpe)
        }
        onWrite(body)
    }

    VibeCard {
        Text("Круг ${slot.round} из $totalRounds · упражнение ${slot.exerciseIndex + 1}")
        Text(exercise.getString("exerciseNameRu"), style = MaterialTheme.typography.titleLarge)
        if (rest > 0) {
            Text(if (slot.exerciseIndex == 0) "Отдых перед кругом" else "Отдых перед упражнением",
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            FormatTimer(rest, !busy)
        }
        if (byTime && target > 0) {
            Text("Время упражнения", color = MaterialTheme.colorScheme.onSurfaceVariant)
            FormatTimer(target, !busy) { actual = it.toString() }
        }
        FormatField(actual, { actual = it }, if (byTime) "Фактическое время, с" else "Повторы", !busy, KeyboardType.Number)
        FormatField(weight, { weight = it }, "Вес, ${weightUnitLabel(weightUnit)}", !busy, KeyboardType.Decimal)
        FormatField(effort, { effort = it }, "Нагрузка RPE (1–10)", !busy, KeyboardType.Decimal)
        Button(onClick = { mark(false) }, enabled = !busy && valid, modifier = Modifier.fillMaxWidth()) {
            Text("Записать упражнение")
        }
        TextButton(onClick = { mark(true) }, enabled = !busy) { Text("Пропустить упражнение") }
    }
}

@Composable
private fun FormatSessionActions(workoutId: String, busy: Boolean, onWrite: (JSONObject) -> Unit) {
    var notes by rememberSaveable(workoutId) { mutableStateOf("") }
    var confirmCancel by rememberSaveable(workoutId) { mutableStateOf(false) }
    VibeCard {
        FormatField(notes, { notes = it.take(500) }, "Как прошла тренировка", !busy, singleLine = false)
        Button(
            onClick = {
                onWrite(JSONObject().put("action", "finish").put("notes", notes.trim().takeIf { it.isNotEmpty() }))
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Завершить тренировку") }
        OutlinedButton(onClick = { confirmCancel = true }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text("Отменить тренировку")
        }
    }
    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text("Отменить тренировку?") },
            text = { Text("Она сохранится в истории со статусом «Отменена».") },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = false
                    onWrite(JSONObject().put("action", "cancel"))
                }, enabled = !busy) { Text("Отменить тренировку") }
            },
            dismissButton = { TextButton(onClick = { confirmCancel = false }) { Text("Вернуться") } },
        )
    }
}

@Composable
private fun FormatTimer(seconds: Int, enabled: Boolean, onUseElapsed: ((Int) -> Unit)? = null) {
    val duration = seconds * 1000L
    var remaining by rememberSaveable(seconds) { mutableLongStateOf(duration) }
    var deadline by rememberSaveable(seconds) { mutableLongStateOf(0L) }
    val running = deadline > 0
    val remainingSeconds = ((remaining + 999) / 1000).toInt()
    LaunchedEffect(deadline) {
        while (deadline > 0) {
            remaining = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0)
            if (remaining == 0L) {
                deadline = 0
                break
            }
            delay(minOf(250L, remaining))
        }
    }
    Text(
        "${remainingSeconds / 60}:${(remainingSeconds % 60).toString().padStart(2, '0')}",
        style = MaterialTheme.typography.headlineSmall,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedButton(
            onClick = {
                if (running) {
                    remaining = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0)
                    deadline = 0
                } else {
                    if (remaining == 0L) remaining = duration
                    deadline = SystemClock.elapsedRealtime() + remaining
                }
            },
            enabled = enabled,
        ) { Text(if (running) "Пауза" else "Запустить") }
        if (remaining < duration) {
            TextButton(
                onClick = { deadline = 0; remaining = duration },
                enabled = enabled,
            ) { Text("Сбросить") }
        }
    }
    if (onUseElapsed != null && remainingSeconds < seconds) {
        TextButton(onClick = { onUseElapsed(seconds - remainingSeconds) }, enabled = enabled) {
            Text("Подставить время таймера")
        }
    }
}
