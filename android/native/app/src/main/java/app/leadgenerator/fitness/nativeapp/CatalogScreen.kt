package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal typealias ScreenRequest = suspend (String, JSONObject?) -> JSONObject

internal data class RemoteJson(val data: JSONObject? = null, val failed: Boolean = false)

@Composable
internal fun loadScreenJson(path: String, refresh: Int, request: ScreenRequest): RemoteJson {
    val state by produceState(RemoteJson(), path, refresh) {
        value = RemoteJson()
        try {
            value = RemoteJson(request(path, null))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            value = RemoteJson(failed = true)
        }
    }
    return state
}

@Composable
internal fun LoadStatus(result: RemoteJson, onRetry: () -> Unit) {
    if (result.failed) {
        VibeCard {
            Text("Не удалось загрузить данные. Проверьте соединение.")
            TextButton(onClick = onRetry) { Text("Обновить") }
        }
    } else if (result.data == null) {
        LinearProgressIndicator(Modifier.fillMaxWidth())
    }
}

@Composable
internal fun CatalogScreen(accountId: String, createTemplate: Boolean, request: ScreenRequest, onSaved: () -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/catalog", refresh, request)
    val catalog = result.data
    val names = catalog?.objects("muscles")?.associate { it.getString("key") to it.getString("nameRu") }.orEmpty()
    var query by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf(ArrayList<String>()) }
    var templateId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    var expanded by rememberSaveable { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val exercises = catalog?.objects("exercises").orEmpty()
    val search = query.trim()
    val visible = exercises.filter {
        it.optString("nameRu").contains(search, ignoreCase = true) || it.optString("nameEn").contains(search, ignoreCase = true)
    }

    VibeList {
        item { VibeHeading(if (createTemplate) "Новый шаблон" else "Упражнения") }
        if (catalog == null) {
            item { LoadStatus(result) { refresh++ } }
        } else {
            if (createTemplate) {
                item {
                    VibeCard {
                        OutlinedTextField(name, { name = it.take(80); templateId = UUID.randomUUID().toString() }, Modifier.fillMaxWidth(),
                            label = { Text("Название тренировки") }, singleLine = true, enabled = !saving)
                        Text("Выбрано: ${selected.size} из 30", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (selected.isNotEmpty()) {
                            val byId = exercises.associateBy { it.getString("id") }
                            selected.mapNotNull { byId[it] }.forEachIndexed { index, item ->
                                Text("${index + 1}. ${item.getString("nameRu")}")
                            }
                        }
                        Button(
                            onClick = {
                                saving = true
                                error = ""
                                scope.launch {
                                    try {
                                        val items = JSONArray()
                                        selected.forEach { exerciseId ->
                                            items.put(JSONObject().put("exerciseId", exerciseId).put("targetSets", 3)
                                                .put("targetRepsMin", 8).put("targetRepsMax", 12).put("targetRestSeconds", 120))
                                        }
                                        request("/api/mobile/v1/catalog", JSONObject().put("accountId", accountId)
                                            .put("templateId", templateId).put("name", name.trim()).put("items", items))
                                        onSaved()
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (_: Exception) {
                                        error = "Не удалось сохранить шаблон. Попробуйте ещё раз."
                                    } finally {
                                        saving = false
                                    }
                                }
                            }, enabled = !saving && name.trim().length >= 2 && selected.isNotEmpty(),
                        ) { Text(if (saving) "Сохраняем…" else "Сохранить шаблон") }
                        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
            item {
                OutlinedTextField(query, { query = it.take(80) }, Modifier.fillMaxWidth(), label = { Text("Поиск упражнений") },
                    leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true)
            }
            if (visible.isEmpty()) item { Text("Упражнения не найдены") }
            items(visible, key = { it.getString("id") }) { exercise ->
                val id = exercise.getString("id")
                val title = exercise.getString("nameRu")
                val muscles = exercise.optJSONArray("primaryMuscles")?.let { keys ->
                    (0 until keys.length()).mapNotNull { names[keys.getString(it)] }.joinToString(" · ")
                }.orEmpty()
                val chosen = id in selected
                val change: () -> Unit = {
                    if (createTemplate && !saving) {
                        if (chosen || selected.size < 30) {
                            val next = if (chosen) selected - id else selected + id
                            selected = ArrayList(next)
                            templateId = UUID.randomUUID().toString()
                        }
                    } else if (!createTemplate) {
                        expanded = if (expanded == id) null else id
                    }
                }
                Surface(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surface) {
                    Row(
                        Modifier.clickable(onClick = change).padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(title, style = MaterialTheme.typography.titleMedium)
                            if (muscles.isNotBlank()) Text(muscles, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (expanded == id) {
                                val description = exercise.takeUnless { it.isNull("description") }?.optString("description").orEmpty()
                                Text(description.ifBlank { exercise.optString("nameEn") }, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        if (createTemplate) Checkbox(checked = chosen, onCheckedChange = null, enabled = !saving)
                    }
                }
            }
        }
    }
}
