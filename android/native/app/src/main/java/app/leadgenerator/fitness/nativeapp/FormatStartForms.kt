package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import java.io.Serializable

private enum class CardioPlan(val wireName: String, val title: String, val plan: String) {
    Tabata("tabata", "Tabata", "8 раундов по 20 с работы и 10 с отдыха"),
    FourByFour("norwegian_4x4", "4×4", "4 раунда по 4 мин работы и 3 мин восстановления"),
    Emom("emom", "EMOM", "Рабочие интервалы по 1 мин"),
    Custom("custom", "Свой план", "Настройте рабочие интервалы и отдых"),
}

@Composable
internal fun CardioStartForm(busy: Boolean, onStart: (JSONObject) -> Unit) {
    var plan by rememberSaveable { mutableStateOf(CardioPlan.Tabata) }
    var name by rememberSaveable { mutableStateOf("") }
    var rounds by rememberSaveable { mutableStateOf("6") }
    var work by rememberSaveable { mutableStateOf("30") }
    var rest by rememberSaveable { mutableStateOf("60") }
    var emomRounds by rememberSaveable { mutableStateOf("10") }
    val validPlan = when (plan) {
        CardioPlan.Custom -> rounds.formatInt(1..60) != null &&
            work.formatInt(5..3600) != null && rest.formatInt(0..3600) != null
        CardioPlan.Emom -> emomRounds.formatInt(1..60) != null
        else -> true
    }
    VibeCard {
        Text("Новая кардиотренировка", style = MaterialTheme.typography.titleLarge)
        CardioPlan.entries.chunked(2).forEach { group ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                group.forEach { option ->
                    FilterChip(
                        selected = option == plan,
                        enabled = !busy,
                        onClick = { plan = option },
                        label = { Text(option.title) },
                    )
                }
            }
        }
        Text(plan.plan, color = MaterialTheme.colorScheme.onSurfaceVariant)
        FormatField(name, { name = it.take(80) }, "Название", !busy, placeholder = plan.title)
        if (plan == CardioPlan.Custom) {
            FormatField(rounds, { rounds = it }, "Раунды (1–60)", !busy, KeyboardType.Number)
            FormatField(work, { work = it }, "Работа, с (5–3600)", !busy, KeyboardType.Number)
            FormatField(rest, { rest = it }, "Отдых, с (0–3600)", !busy, KeyboardType.Number)
        }
        if (plan == CardioPlan.Emom) {
            FormatField(emomRounds, { emomRounds = it }, "Раунды (1–60)", !busy, KeyboardType.Number)
        }
        Button(
            enabled = !busy && validPlan,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val body = JSONObject()
                    .put("action", "start")
                    .put("preset", plan.wireName)
                    .put("name", name.trim().ifBlank { plan.title })
                when (plan) {
                    CardioPlan.Custom -> body.put("rounds", rounds.formatInt(1..60))
                        .put("workSec", work.formatInt(5..3600))
                        .put("restSec", rest.formatInt(0..3600))
                    CardioPlan.Emom -> body.put("emomRounds", emomRounds.formatInt(1..60))
                    else -> Unit
                }
                onStart(body)
            },
        ) { Text("Начать кардио") }
    }
}

private data class DraftCircuitExercise(
    val id: String,
    val name: String,
    val byTime: Boolean = false,
    val reps: String = "10",
    val seconds: String = "30",
    val weight: String = "",
) : Serializable {
    fun toJson(weightUnit: String): JSONObject? {
        val parsedWeight = weight.formatWeight(weightUnit)
        if (weight.isNotBlank() && parsedWeight == null) return null
        val result = JSONObject()
            .put("exerciseId", id)
            .put("kind", if (byTime) "duration" else "reps")
            .put("targetWeightKg", parsedWeight)
        return if (byTime) {
            result.put("targetDurationSec", seconds.formatInt(1..3600) ?: return null)
        } else {
            result.put("targetReps", reps.formatInt(1..500) ?: return null)
        }
    }
}

@Composable
internal fun CircuitStartForm(
    request: ScreenRequest,
    accountId: String?,
    weightUnit: String,
    busy: Boolean,
    onStart: (JSONObject) -> Unit,
) {
    var refresh by remember { mutableIntStateOf(0) }
    val catalog = loadScreenJson("/api/mobile/v1/formats?exercises=1", refresh, request)
    val available = catalog.data?.takeIf { it.formatText("accountId") == accountId }?.objects("exercises")
    var name by rememberSaveable { mutableStateOf("") }
    var rounds by rememberSaveable { mutableStateOf("3") }
    var roundRest by rememberSaveable { mutableStateOf("60") }
    var exerciseRest by rememberSaveable { mutableStateOf("15") }
    var query by rememberSaveable { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf<List<DraftCircuitExercise>>(emptyList()) }
    val exercisePayloads = selected.mapNotNull { it.toJson(weightUnit) }
    val roundCount = rounds.formatInt(1..30)
    val restBetweenRounds = roundRest.formatInt(0..3600)
    val restBetweenExercises = exerciseRest.formatInt(0..3600)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        VibeCard {
            Text("Новая круговая тренировка", style = MaterialTheme.typography.titleLarge)
            FormatField(name, { name = it.take(80) }, "Название", !busy, placeholder = "Круговая")
            FormatField(rounds, { rounds = it }, "Круги (1–30)", !busy, KeyboardType.Number)
            FormatField(roundRest, { roundRest = it }, "Отдых между кругами, с", !busy, KeyboardType.Number)
            FormatField(exerciseRest, { exerciseRest = it }, "Отдых между упражнениями, с", !busy, KeyboardType.Number)
        }
        selected.forEachIndexed { index, exercise ->
            fun update(value: DraftCircuitExercise) {
                selected = selected.mapIndexed { position, item -> if (position == index) value else item }
            }
            VibeCard {
                Text(exercise.name, style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = !exercise.byTime,
                        onClick = { update(exercise.copy(byTime = false)) },
                        label = { Text("Повторы") },
                        enabled = !busy,
                    )
                    FilterChip(
                        selected = exercise.byTime,
                        onClick = { update(exercise.copy(byTime = true)) },
                        label = { Text("Время") },
                        enabled = !busy,
                    )
                }
                if (exercise.byTime) {
                    FormatField(exercise.seconds, { update(exercise.copy(seconds = it)) }, "Время, с", !busy, KeyboardType.Number)
                } else {
                    FormatField(exercise.reps, { update(exercise.copy(reps = it)) }, "Повторы", !busy, KeyboardType.Number)
                }
                FormatField(exercise.weight, { update(exercise.copy(weight = it)) }, "Вес, ${weightUnitLabel(weightUnit)}",
                    !busy, KeyboardType.Decimal)
                TextButton(onClick = { selected = selected.filterIndexed { position, _ -> position != index } }, enabled = !busy) {
                    Text("Убрать упражнение")
                }
            }
        }
        if (available == null) {
            if (catalog.data != null) VibeCard { Text("Войдите в свой аккаунт заново") }
            else LoadStatus(catalog) { refresh++ }
        } else if (selected.size < 20) {
            VibeCard {
                Text("Добавить упражнение", style = MaterialTheme.typography.titleMedium)
                FormatField(query, { query = it }, "Поиск по названию", !busy)
                val used = selected.map { it.id }.toSet()
                val matching = available.filter {
                    it.getString("id") !in used &&
                        (it.optString("nameRu").contains(query.trim(), ignoreCase = true) ||
                            it.optString("nameEn").contains(query.trim(), ignoreCase = true))
                }
                matching.take(12).forEach { option ->
                    TextButton(
                        enabled = !busy,
                        onClick = {
                            selected = selected + DraftCircuitExercise(option.getString("id"), option.getString("nameRu"))
                            query = ""
                        },
                    ) { Text(option.getString("nameRu")) }
                }
                if (matching.isEmpty()) Text("Упражнения не найдены")
                if (matching.size > 12) Text("Уточните поиск, чтобы увидеть другие упражнения")
            }
        }
        Button(
            enabled = !busy && available != null && selected.isNotEmpty() && exercisePayloads.size == selected.size &&
                roundCount != null && restBetweenRounds != null && restBetweenExercises != null,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                onStart(
                    JSONObject()
                        .put("action", "start")
                        .put("name", name.trim().ifBlank { "Круговая" })
                        .put("totalRounds", roundCount)
                        .put("restBetweenRoundsSec", restBetweenRounds)
                        .put("restBetweenExercisesSec", restBetweenExercises)
                        .put("exercises", JSONArray(exercisePayloads)),
                )
            },
        ) { Text("Начать круговую") }
    }
}

internal fun String.formatInt(range: IntRange): Int? = trim().toIntOrNull()?.takeIf { it in range }

internal fun String.formatDecimal(range: ClosedFloatingPointRange<Double>): Double? =
    trim().replace(',', '.').toDoubleOrNull()?.takeIf { it in range }

internal fun String.formatWeight(unit: String): Double? =
    trim().replace(',', '.').toDoubleOrNull()?.let { weightToKilos(it, unit) }?.takeIf { it in 0.0..1000.0 }

@Composable
internal fun FormatField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    keyboard: KeyboardType = KeyboardType.Text,
    placeholder: String? = null,
    singleLine: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        enabled = enabled,
        placeholder = { if (placeholder != null) Text(placeholder) },
        singleLine = singleLine,
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
    )
}
