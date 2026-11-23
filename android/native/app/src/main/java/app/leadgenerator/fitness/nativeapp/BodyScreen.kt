package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

internal data class BodyMuscle(
    val key: String, val label: String, val color: String, val levelLabel: String,
    val sets: Int, val volume: Double, val lastTrained: String, val forgottenWeeks: Int?,
    val goalTarget: Double?, val exercises: List<String>, val records: List<String>,
    val weeklyVolume: List<Double>,
)

private data class BodySnapshot(
    val accountId: String, val hasTrainingData: Boolean, val height: Double?, val weight: Double?,
    val muscles: List<BodyMuscle>,
)

@Composable
internal fun BodyScreen(request: ScreenRequest) {
    val currentRequest by rememberUpdatedState(request)
    var snapshot by remember { mutableStateOf<BodySnapshot?>(null) }
    var selected by remember { mutableStateOf<String?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val uri = LocalUriHandler.current

    LaunchedEffect(refresh) {
        loading = true
        error = null
        try {
            val next = withContext(Dispatchers.IO) { readBody(currentRequest("/api/mobile/v1/body", null)) }
            if (next.accountId != snapshot?.accountId) selected = null
            snapshot = next
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            if (failure is HttpFailure && (failure.code == 401 || failure.code == 409)) snapshot = null
            error = "Не удалось загрузить нагрузку мышц. Проверьте подключение и повторите."
        } finally { loading = false }
    }

    VibeList {
        item("body-heading") {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { VibeHeading("Моё тело") }
                IconButton(onClick = { refresh++ }, enabled = !loading) {
                    Icon(Icons.Filled.Refresh, contentDescription = "Обновить нагрузку мышц")
                }
            }
        }
        if (loading) item("body-loading") {
            if (snapshot == null) VibeCard {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(24.dp))
                    Text("Загружаем историю мышц")
                }
            } else LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        error?.let { message -> item("body-error") {
            VibeCard {
                Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { refresh++ }, enabled = !loading) { Text("Повторить") }
            }
        } }
        snapshot?.let { body ->
            if (!body.hasTrainingData) item("body-empty") {
                VibeCard { Text("За последние 7 дней нагрузки пока нет. Завершите тренировку — цвет мышц покажет рабочие подходы.") }
            }
            item("body-model") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainer) {
                        NativeMuscleModel(body.muscles, selected, { selected = it }, Modifier.fillMaxWidth().height(420.dp))
                    }
                    Text("Вращайте одним пальцем, приближайте двумя. Нажмите на мышцу или выберите группу ниже.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            body.muscles.firstOrNull { it.key == selected }?.let { muscle -> item("body-selected") {
                VibeCard {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(muscle.label, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                        OutlinedButton(onClick = { selected = null }) { Text("Снять выбор") }
                    }
                    Text("${muscle.sets} подходов · ${formatNumber(muscle.volume, 0)} кг·повт за 7 дней", style = MaterialTheme.typography.bodyMedium)
                    Text("Последняя нагрузка: ${muscle.lastTrained}", style = MaterialTheme.typography.bodySmall)
                    muscle.forgottenWeeks?.let { Text("Без нагрузки: $it нед.", color = MaterialTheme.colorScheme.tertiary) }
                    muscle.goalTarget?.let { Text("Цель: ${formatNumber(it)} подходов в неделю") }
                    if (muscle.exercises.isNotEmpty()) {
                        HorizontalDivider()
                        Text("Упражнения за неделю", style = MaterialTheme.typography.titleSmall)
                        muscle.exercises.forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
                    }
                    if (muscle.records.isNotEmpty()) {
                        HorizontalDivider()
                        Text("Личные рекорды", style = MaterialTheme.typography.titleSmall)
                        muscle.records.forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
                    }
                    if (muscle.weeklyVolume.isNotEmpty()) {
                        HorizontalDivider()
                        Text("Тоннаж по неделям · от ранней к текущей", style = MaterialTheme.typography.titleSmall)
                        Text(muscle.weeklyVolume.joinToString(" → ") { formatNumber(it, 0) } + " кг·повт", style = MaterialTheme.typography.bodySmall)
                    }
                }
            } }
            item("body-groups") {
                VibeCard {
                    Text("Нагрузка за 7 дней", style = MaterialTheme.typography.titleMedium)
                    Text("Цвет отражает число рабочих подходов, а не процент восстановления.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    body.muscles.forEach { muscle ->
                        Surface(color = if (selected == muscle.key) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
                            shape = MaterialTheme.shapes.medium) {
                            Row(Modifier.fillMaxWidth().clickable(onClickLabel = "Показать историю мышцы") { selected = muscle.key }
                                .padding(horizontal = 8.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(12.dp).background(bodyHeatColor(muscle.color), CircleShape))
                                Column(Modifier.weight(1f)) {
                                    Text(muscle.label, style = MaterialTheme.typography.bodyMedium)
                                    Text(muscle.forgottenWeeks?.let { "Без нагрузки $it нед." } ?: muscle.levelLabel,
                                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text("${muscle.sets}", style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                }
            }
            item("body-metrics") {
                VibeCard {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Рост · ${body.height?.let { "${formatNumber(it)} см" } ?: "—"}")
                        Text("Вес · ${body.weight?.let { "${formatNumber(it)} кг" } ?: "—"}")
                    }
                }
            }
            item("body-credit") {
                Text("3D: Myology · Z-Anatomy · CC BY-SA 4.0 ↗",
                    Modifier.clickable { uri.openUri("https://sketchfab.com/3d-models/myology-31b40fd809b14665b93773936d67c52c") }.padding(8.dp),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private fun readBody(json: JSONObject): BodySnapshot {
    val muscles = json.getJSONArray("muscles").bodyObjects().map { row ->
        BodyMuscle(
            key = row.getString("key"), label = row.getString("label"), color = row.getString("color"),
            levelLabel = row.getString("levelLabel"), sets = row.getInt("sets"), volume = row.getDouble("volume7d"),
            lastTrained = row.getString("lastTrainedLabel"), forgottenWeeks = row.bodyNumber("forgottenWeeks")?.toInt(),
            goalTarget = row.bodyNumber("goalTarget"),
            exercises = row.getJSONArray("top3").bodyObjects().map { "${it.getString("name")} · ${formatNumber(it.getDouble("volume"), 0)} кг·повт" },
            records = row.getJSONArray("records").bodyObjects().map { "${it.getString("name")} · ${formatNumber(it.getDouble("weightKg"))} кг × ${it.getInt("reps")}" },
            weeklyVolume = row.getJSONArray("weeklyVolume").let { array -> List(array.length()) { array.getDouble(it) } },
        )
    }
    return BodySnapshot(json.getString("accountId"), json.getBoolean("hasTrainingData"),
        json.bodyNumber("heightCm"), json.bodyNumber("weightKg"), muscles)
}

private fun JSONArray.bodyObjects(): List<JSONObject> = List(length()) { getJSONObject(it) }
private fun JSONObject.bodyNumber(key: String): Double? = if (isNull(key)) null else getDouble(key)
internal fun bodyHeatColor(hex: String): Color = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray)
