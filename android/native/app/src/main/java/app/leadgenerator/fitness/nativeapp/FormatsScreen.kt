package app.leadgenerator.fitness.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

private const val FormatsPath = "/api/mobile/v1/formats"

internal enum class TrainingFormat(val wireName: String, val title: String) {
    Cardio("cardio", "Кардио"),
    Circuit("circuit", "Круговые"),
}

internal fun JSONObject.formatText(name: String): String? =
    if (isNull(name)) null else optString(name).takeIf { it.isNotBlank() }

internal fun JSONObject.formatNumberOrNull(name: String): Number? =
    if (isNull(name)) null else opt(name) as? Number

@Composable
internal fun FormatsScreen(request: ScreenRequest, accountId: String? = null, weightUnit: String = "kg") {
    var kind by rememberSaveable { mutableStateOf(TrainingFormat.Cardio) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var pendingStart by rememberSaveable { mutableStateOf("") }
    var pendingStartId by rememberSaveable { mutableStateOf("") }
    var refresh by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val detailId = selectedId
    val path = if (detailId == null) FormatsPath else "$FormatsPath?kind=${kind.wireName}&id=$detailId"
    val result = key(path) { loadScreenJson(path, refresh, request) }
    val remoteAccount = result.data?.formatText("accountId")
    val owner = accountId ?: remoteAccount
    val data = result.data?.takeIf { owner != null && remoteAccount == owner }

    fun back() {
        selectedId = null
        creating = false
        error = null
    }

    fun openWorkout(id: String) {
        selectedId = id
        creating = false
        error = null
    }

    fun send(body: JSONObject, onSuccess: (JSONObject) -> Unit) {
        if (owner == null || data == null || busy) return
        error = null
        busy = true
        scope.launch {
            try {
                val response = request(FormatsPath, body.put("kind", kind.wireName).put("accountId", owner))
                onSuccess(response)
                refresh++
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: HttpFailure) {
                error = when (failure.reason) {
                    "account_changed", "sign_in_required" -> "Войдите в свой аккаунт заново"
                    "workout_status_conflict" -> "Состояние тренировки изменилось. Обновите данные."
                    "workout_not_found" -> "Тренировка больше недоступна"
                    "template_not_found" -> "Шаблон больше недоступен"
                    "exercise_not_found" -> "Упражнение больше недоступно"
                    "invalid_format_request", "round_out_of_range" -> "Проверьте введённые значения"
                    else -> "Не удалось сохранить. Попробуйте ещё раз."
                }
            } catch (_: Exception) {
                error = "Не удалось сохранить. Проверьте соединение и повторите попытку."
            } finally {
                busy = false
            }
        }
    }

    fun start(body: JSONObject) {
        if (busy || data == null) return
        val draft = "${kind.wireName}:$body"
        if (draft != pendingStart) {
            pendingStart = draft
            pendingStartId = UUID.randomUUID().toString()
        }
        send(body.put("clientWorkoutId", pendingStartId)) { response ->
            openWorkout(response.getString("workoutId"))
            pendingStart = ""
            pendingStartId = ""
        }
    }

    BackHandler(enabled = (detailId != null || creating) && !busy) { back() }

    VibeList {
        item {
            when {
                detailId != null || creating -> TextButton(onClick = ::back, enabled = !busy) {
                    Text("К тренировкам")
                }
                else -> VibeHeading("Кардио и круговые")
            }
        }
        if (error != null) {
            item {
                VibeCard {
                    Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = { error = null; refresh++ }, enabled = !busy) { Text("Обновить") }
                }
            }
        }
        if (data == null) {
            item {
                if (result.data != null) {
                    VibeCard { Text("Войдите в свой аккаунт заново") }
                } else {
                    LoadStatus(result) { refresh++ }
                }
            }
        } else if (detailId != null) {
            formatWorkoutDetails(kind, data, busy, weightUnit) { body ->
                send(body.put("workoutId", detailId)) { }
            }
        } else if (creating) {
            item {
                when (kind) {
                    TrainingFormat.Cardio -> CardioStartForm(busy, ::start)
                    TrainingFormat.Circuit -> CircuitStartForm(request, owner, weightUnit, busy, ::start)
                }
            }
        } else {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TrainingFormat.entries.forEach { format ->
                        FilterChip(
                            selected = kind == format,
                            enabled = !busy,
                            onClick = { kind = format; error = null },
                            label = { Text(format.title) },
                        )
                    }
                }
            }
            formatOverview(
                kind = kind,
                section = data.getJSONObject(kind.wireName),
                busy = busy,
                onCreate = { creating = true; error = null },
                onOpen = ::openWorkout,
                onStartTemplate = { template ->
                    start(JSONObject().put("action", "start_template").put("templateId", template))
                },
            )
        }
    }
}

private fun LazyListScope.formatOverview(
    kind: TrainingFormat,
    section: JSONObject,
    busy: Boolean,
    onCreate: () -> Unit,
    onOpen: (String) -> Unit,
    onStartTemplate: (String) -> Unit,
) {
    val recent = section.objects("recent")
    val activeId = section.formatText("activeId")
    if (activeId != null) {
        item {
            VibeCard {
                val title = recent.firstOrNull { it.optString("id") == activeId }?.formatText("name")
                Text(title ?: "Активная тренировка", style = MaterialTheme.typography.titleLarge)
                Button(onClick = { onOpen(activeId) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    Text("Продолжить")
                }
            }
        }
    } else {
        item {
            Button(onClick = onCreate, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                Text(if (kind == TrainingFormat.Cardio) "Начать кардио" else "Начать круговую")
            }
        }
        val templates = section.objects("templates")
        if (templates.isNotEmpty()) {
            item { Text("Мои шаблоны", style = MaterialTheme.typography.titleLarge) }
            items(templates, key = { "template-${it.getString("id")}" }) { template ->
                VibeCard {
                    Text(template.optString("name"), style = MaterialTheme.typography.titleMedium)
                    template.formatText("description")?.let { Text(it) }
                    Text(template.formatText("metaLine")
                        ?: "Упражнений: ${template.optInt("exerciseCount")}")
                    TextButton(onClick = { onStartTemplate(template.getString("id")) }, enabled = !busy) {
                        Text("Начать по шаблону")
                    }
                }
            }
        }
    }
    item { Text("История", style = MaterialTheme.typography.titleLarge) }
    val history = recent.filterNot { it.optString("id") == activeId }
    if (history.isEmpty()) item { VibeCard { Text("Тренировок пока нет") } }
    items(history, key = { "${kind.wireName}-${it.getString("id")}" }) { workout ->
        VibeCard(Modifier.clickable(enabled = !busy) { onOpen(workout.getString("id")) }) {
            Text(workout.optString("name"), style = MaterialTheme.typography.titleMedium)
            val metrics = if (kind == TrainingFormat.Cardio) {
                val performed = workout.optInt("totalActualSec")
                listOf(
                    "${workout.optInt("completedWorkCount")} / ${workout.optInt("workBlockCount")} интервалов",
                    formatsDuration(if (performed > 0) performed else workout.optInt("totalPlannedSec")),
                )
            } else {
                listOf("${workout.optInt("totalRounds")} круг.", "${workout.optInt("exerciseCount")} упр.")
            }
            Text((listOf(formatWorkoutDate(workout.optString("startedAt")), formatStatus(workout.optString("status"))) + metrics)
                .filter { it.isNotBlank() }.joinToString(" · "),
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

internal fun formatStatus(status: String): String = when (status) {
    "active" -> "В процессе"
    "completed" -> "Завершена"
    "cancelled" -> "Отменена"
    else -> ""
}

internal fun formatsDuration(seconds: Int): String = when {
    seconds < 60 -> "$seconds с"
    seconds % 60 == 0 -> "${seconds / 60} мин"
    else -> "${seconds / 60} мин ${seconds % 60} с"
}
