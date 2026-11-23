package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

@Composable
internal fun TemplateEditor(accountId: String, templateId: String?, request: ScreenRequest, onSaved: () -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val path = "/api/mobile/v1/catalog" + (templateId?.let { "?templateId=$it" } ?: "")
    val result = loadScreenJson(path, refresh, request)
    var draftText by rememberSaveable(templateId) { mutableStateOf<String?>(null) }
    var clientId by rememberSaveable(templateId) { mutableStateOf(templateId ?: UUID.randomUUID().toString()) }
    var search by rememberSaveable(templateId) { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val data = result.data
    LaunchedEffect(data, templateId) {
        if (data != null && draftText == null) {
            val draft = data.optJSONObject("template")?.let { JSONObject(it.toString()) }
                ?: JSONObject().put("name", "").put("description", "").put("items", JSONArray())
            draft.objects("items").forEach { it.put("draftKey", UUID.randomUUID().toString()) }
            draftText = draft.toString()
        }
    }
    val draft = draftText?.let(::JSONObject)
    val entries = draft?.objects("items").orEmpty()
    val exercises = data?.objects("exercises").orEmpty()
    val names = exercises.associate { it.getString("id") to it.getString("nameRu") }

    fun changed(next: JSONObject) {
        draftText = next.toString()
        if (templateId == null) clientId = UUID.randomUUID().toString()
        error = ""
    }
    fun itemChanged(index: Int, key: String, value: Any) {
        if (draft != null && !saving) {
            draft.getJSONArray("items").getJSONObject(index).put(key, value)
            changed(draft)
        }
    }
    fun replaceItems(next: List<JSONObject>) {
        if (draft != null && !saving) changed(draft.put("items", JSONArray(next)))
    }
    val valid = draft != null && draft.optString("name").trim().length >= 2 && entries.isNotEmpty()
        && entries.all(::validTemplateTarget)

    VibeList {
        item { VibeHeading(if (templateId == null) "Новый шаблон" else "Редактировать шаблон", "Настройте упражнения и нагрузку под себя.") }
        if (data == null || draft == null) {
            item { LoadStatus(result) { refresh++ } }
        } else {
            item {
                VibeCard {
                    OutlinedTextField(draft.text("name"), { changed(draft.put("name", it.take(80))) }, Modifier.fillMaxWidth(),
                        label = { Text("Название") }, singleLine = true, enabled = !saving)
                    OutlinedTextField(draft.text("description"), { changed(draft.put("description", it.take(500))) }, Modifier.fillMaxWidth(),
                        label = { Text("Описание") }, minLines = 2, enabled = !saving)
                    Text("Упражнений: ${entries.size} / 30", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            itemsIndexed(entries, key = { _, item -> item.getString("draftKey") }) { index, item ->
                VibeCard {
                    Text("${index + 1}. ${names[item.optString("exerciseId")] ?: item.optString("exerciseNameRu", "Упражнение")}",
                        style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TargetField("Подходы", item.text("targetSets"), "1–20", !saving, Modifier.weight(1f)) { itemChanged(index, "targetSets", it) }
                        TargetField("Повторы от", item.text("targetRepsMin"), "1–100", !saving, Modifier.weight(1f)) { itemChanged(index, "targetRepsMin", it) }
                        TargetField("До", item.text("targetRepsMax"), "1–100", !saving, Modifier.weight(1f)) { itemChanged(index, "targetRepsMax", it) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TargetField("Вес, кг", item.text("targetWeightKg"), "Не задан", !saving, Modifier.weight(1f), decimal = true) { itemChanged(index, "targetWeightKg", it.replace(',', '.')) }
                        TargetField("Отдых, сек", item.text("targetRestSeconds"), "15–900", !saving, Modifier.weight(1f)) { itemChanged(index, "targetRestSeconds", it) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(item.optBoolean("myoReps"), { itemChanged(index, "myoReps", it) }, enabled = !saving)
                        Column {
                            Text("Миорепсы")
                            Text("Активационный подход и мини-сеты", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (item.optBoolean("myoReps")) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TargetField("Мини-сеты", item.text("myoMiniSets"), "1–10", !saving, Modifier.weight(1f)) { itemChanged(index, "myoMiniSets", it) }
                            TargetField("Повторы", item.text("myoMiniReps"), "1–10", !saving, Modifier.weight(1f)) { itemChanged(index, "myoMiniReps", it) }
                            TargetField("Пауза, сек", item.text("myoMiniRestSeconds"), "5–30", !saving, Modifier.weight(1f)) { itemChanged(index, "myoMiniRestSeconds", it) }
                        }
                    }
                    OutlinedTextField(item.text("notes"), { itemChanged(index, "notes", it.take(500)) }, Modifier.fillMaxWidth(),
                        label = { Text("Заметка к упражнению") }, enabled = !saving)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(enabled = !saving && index > 0, onClick = {
                            val next = entries.toMutableList(); next[index] = next[index - 1]; next[index - 1] = item; replaceItems(next)
                        }) { Text("Выше") }
                        TextButton(enabled = !saving && index < entries.lastIndex, onClick = {
                            val next = entries.toMutableList(); next[index] = next[index + 1]; next[index + 1] = item; replaceItems(next)
                        }) { Text("Ниже") }
                        TextButton(enabled = !saving, onClick = { replaceItems(entries.filterIndexed { i, _ -> i != index }) }) { Text("Удалить") }
                    }
                    if (!validTemplateTarget(item)) Text("Проверьте числа: повторов «до» должно быть не меньше «от».", color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall)
                }
            }
            item {
                VibeCard {
                    Text("Добавить упражнение", style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(search, { search = it.take(80) }, Modifier.fillMaxWidth(), label = { Text("Поиск по каталогу") }, singleLine = true, enabled = !saving)
                    Text("Введите название и добавьте движение в конец тренировки.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            val available = exercises.filter { exercise ->
                entries.none { it.optString("exerciseId") == exercise.getString("id") }
                    && (exercise.optString("nameRu").contains(search, true) || exercise.optString("nameEn").contains(search, true))
            }.take(12)
            itemsIndexed(available, key = { _, item -> "add-${item.getString("id")}" }) { _, exercise ->
                OutlinedButton(enabled = !saving && entries.size < 30, modifier = Modifier.fillMaxWidth(), onClick = {
                    replaceItems(entries + JSONObject().put("exerciseId", exercise.getString("id"))
                        .put("draftKey", UUID.randomUUID().toString()).put("targetSets", 3).put("targetRepsMin", 8)
                        .put("targetRepsMax", 12).put("targetWeightKg", "").put("targetRestSeconds", 120)
                        .put("myoReps", false).put("myoMiniSets", 3).put("myoMiniReps", 5).put("myoMiniRestSeconds", 20).put("notes", ""))
                }) { Text("+ ${exercise.getString("nameRu")}") }
            }
            if (available.isEmpty()) item { Text("Нет подходящих упражнений") }
            item {
                VibeCard {
                    if (saving) LinearProgressIndicator(Modifier.fillMaxWidth())
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                    Button(enabled = valid && !saving, modifier = Modifier.fillMaxWidth(), onClick = {
                        saving = true; error = ""
                        val payload = JSONObject(draft.toString()).put("accountId", accountId).put("templateId", clientId)
                            .put("action", if (templateId == null) "create" else "update")
                        scope.launch {
                            try {
                                request("/api/mobile/v1/catalog", payload)
                                onSaved()
                            } catch (cancelled: CancellationException) { throw cancelled
                            } catch (failure: HttpFailure) {
                                error = when (failure.reason) {
                                    "template_not_found" -> "Шаблон больше недоступен. Вернитесь к списку."
                                    "exercise_not_found" -> "Одно из упражнений больше недоступно. Обновите каталог."
                                    "invalid_template" -> "Проверьте название, числа и заметки."
                                    "account_changed", "sign_in_required" -> "Войдите в свой аккаунт снова."
                                    else -> "Не удалось сохранить. Попробуйте ещё раз."
                                }
                            } catch (_: Exception) { error = "Проверьте соединение и повторите сохранение."
                            } finally { saving = false }
                        }
                    }) { Text(if (saving) "Сохраняем…" else "Сохранить шаблон") }
                }
            }
        }
    }
}

private fun JSONObject.text(key: String) = if (isNull(key)) "" else optString(key)

private fun validTemplateTarget(item: JSONObject): Boolean {
    fun within(key: String, low: Int, high: Int) = item.text(key).toIntOrNull()?.let { it in low..high } == true
    val weight = item.text("targetWeightKg")
    return within("targetSets", 1, 20) && within("targetRepsMin", 1, 100) && within("targetRepsMax", 1, 100)
        && (item.text("targetRepsMax").toIntOrNull() ?: 0) >= (item.text("targetRepsMin").toIntOrNull() ?: 1)
        && within("targetRestSeconds", 15, 900) && within("myoMiniSets", 1, 10) && within("myoMiniReps", 1, 10)
        && within("myoMiniRestSeconds", 5, 30) && (weight.isBlank() || weight.toDoubleOrNull()?.let { it.isFinite() && it in 0.0..1000.0 } == true)
}

@Composable
private fun TargetField(label: String, value: String, hint: String, enabled: Boolean, modifier: Modifier, decimal: Boolean = false, onChange: (String) -> Unit) {
    OutlinedTextField(value, { onChange(it.take(8)) }, modifier, label = { Text(label) }, placeholder = { Text(hint) },
        enabled = enabled, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number))
}
