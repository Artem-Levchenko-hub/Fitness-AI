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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import org.json.JSONObject

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
internal fun CatalogScreen(accountId: String, createTemplate: Boolean, request: ScreenRequest, templateId: String? = null, onSaved: () -> Unit) {
    if (createTemplate) {
        TemplateEditor(accountId, templateId, request, onSaved)
        return
    }
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/catalog", refresh, request)
    val catalog = result.data
    val names = catalog?.objects("muscles")?.associate { it.getString("key") to it.getString("nameRu") }.orEmpty()
    var query by rememberSaveable { mutableStateOf("") }
    var expanded by rememberSaveable { mutableStateOf<String?>(null) }
    val exercises = catalog?.objects("exercises").orEmpty()
    val search = query.trim()
    val visible = exercises.filter {
        it.optString("nameRu").contains(search, ignoreCase = true) || it.optString("nameEn").contains(search, ignoreCase = true)
    }

    VibeList {
        item { VibeHeading("Упражнения") }
        if (catalog == null) {
            item { LoadStatus(result) { refresh++ } }
        } else {
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
                val change: () -> Unit = {
                    expanded = if (expanded == id) null else id
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
                    }
                }
            }
        }
    }
}
