package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.time.LocalDate

private enum class ProgressTab(val label: String) {
    TRAINING("Тренировки"), MEASUREMENTS("Замеры"), SLEEP("Сон"), NUTRITION("Питание"),
}

@Composable
internal fun ProgressScreen(request: suspend (String, JSONObject?) -> JSONObject, active: Boolean = true) {
    val currentRequest by rememberUpdatedState(request)
    var snapshot by remember { mutableStateOf<ProgressSnapshot?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var confirmation by remember { mutableStateOf<String?>(null) }
    var tab by rememberSaveable { mutableStateOf(ProgressTab.TRAINING) }
    var editorKind by rememberSaveable { mutableStateOf<ProgressEntryKind?>(null) }
    var editorDate by rememberSaveable { mutableStateOf<String?>(null) }
    var editorAccount by rememberSaveable { mutableStateOf<String?>(null) }

    fun closeEditor() {
        editorKind = null
        editorDate = null
        editorAccount = null
    }

    fun loadAgain() {
        loading = true
        loadError = null
        confirmation = null
        refresh++
    }

    LaunchedEffect(refresh, active) {
        if (!active) return@LaunchedEffect
        loading = true
        loadError = null
        try {
            val next = ProgressSnapshot.read(currentRequest(PROGRESS_PATH, null))
            if (editorAccount != null && editorAccount != next.accountId) closeEditor()
            snapshot = next
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: HttpFailure) {
            if (failure.code == 401 || failure.code == 409) {
                snapshot = null
                closeEditor()
            }
            loadError = progressLoadError(failure)
        } catch (_: Exception) {
            loadError = "Не удалось загрузить прогресс. Проверьте подключение."
        } finally {
            loading = false
        }
    }

    val data = snapshot
    val openEditor: (ProgressEntryKind, LocalDate) -> Unit = { kind, date ->
        if (data != null && !loading) {
            confirmation = null
            editorAccount = data.accountId
            editorDate = date.toString()
            editorKind = kind
        }
    }

    VibeList {
        item("progress-heading") {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { VibeHeading("Прогресс") }
                IconButton(onClick = ::loadAgain, enabled = !loading && editorKind == null) {
                    Icon(Icons.Filled.Refresh, contentDescription = "Обновить прогресс")
                }
            }
        }
        if (loading && data == null) {
            item("progress-loading") {
                VibeCard {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator(Modifier.size(24.dp))
                        Text("Загружаем прогресс", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        } else if (loading) {
            item("progress-refresh") { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        }
        loadError?.let { message ->
            item("progress-error") {
                VibeCard {
                    Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error)
                    OutlinedButton(onClick = ::loadAgain, enabled = !loading) { Text("Повторить") }
                }
            }
        }
        if (data != null) {
            item("progress-tabs") {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    for (option in ProgressTab.entries) {
                        FilterChip(
                            selected = tab == option,
                            onClick = { tab = option; confirmation = null },
                            label = { Text(option.label, maxLines = 1) },
                        )
                    }
                }
            }
            confirmation?.let { message ->
                item("progress-saved") {
                    Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.primary)
                }
            }
            when (tab) {
                ProgressTab.TRAINING -> trainingSection(data.training)
                ProgressTab.MEASUREMENTS -> measurementSection(data, !loading, openEditor)
                ProgressTab.SLEEP -> dailySection(data.today, data.sleepToday, data.sleep, ProgressEntryKind.SLEEP, !loading, openEditor)
                ProgressTab.NUTRITION ->
                    dailySection(data.today, data.nutritionToday, data.nutrition, ProgressEntryKind.NUTRITION, !loading, openEditor)
            }
        }
    }

    val kind = editorKind
    val date = editorDate?.let(LocalDate::parse)
    if (kind != null && date != null && data != null && editorAccount == data.accountId) {
        key(data.accountId, kind, date) {
            ProgressEditor(
                kind = kind,
                initialDate = date,
                existing = data.entryFor(kind, date),
                save = { selectedDate, values, clientEntryId ->
                    val body = JSONObject().put("accountId", data.accountId)
                        .put("kind", kind.code).put("date", selectedDate.toString()).put("values", values)
                    if (clientEntryId != null) body.put("clientEntryId", clientEntryId)
                    val reply = currentRequest(PROGRESS_PATH, body)
                    check(reply.getString("kind") == kind.code)
                    ProgressEntry.read(reply.getJSONObject("entry"), kind)
                },
                onSaved = { saved ->
                    snapshot = snapshot?.withEntry(kind, saved)
                    confirmation = when (kind) {
                        ProgressEntryKind.MEASUREMENT -> "Замер сохранён"
                        ProgressEntryKind.SLEEP -> "Запись о сне сохранена"
                        ProgressEntryKind.NUTRITION -> "Запись о питании сохранена"
                    }
                    closeEditor()
                },
                onSessionError = { failure ->
                    snapshot = null
                    loadError = progressLoadError(failure)
                    closeEditor()
                },
                onDismiss = ::closeEditor,
            )
        }
    }
}

private fun progressLoadError(failure: HttpFailure): String = when (failure.code) {
    401 -> "Войдите снова, чтобы открыть прогресс."
    409 -> "Аккаунт изменился. Обновите данные."
    else -> "Не удалось загрузить прогресс. Попробуйте ещё раз."
}

private fun LazyListScope.trainingSection(days: List<ProgressDay>) {
    val active = days.filter { it.count > 0 || it.sets > 0 || it.volumeKg > 0 }
    item("training-overview") {
        VibeCard {
            Text("Последние 30 дней", style = MaterialTheme.typography.headlineSmall)
            if (active.isEmpty()) {
                Text("Здесь появится история завершённых тренировок и дополнительной активности.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ProgressFact(formatNumber(days.sumOf { it.volumeKg }, 1), "Объём, кг", Modifier.weight(1f))
                    ProgressFact(formatNumber(active.size), "Активных дней", Modifier.weight(1f))
                }
                TrainingChart(days)
            }
        }
    }
    if (active.isNotEmpty()) {
        item("training-history") {
            VibeCard {
                Text("Недавняя активность", style = MaterialTheme.typography.titleMedium)
                for ((index, day) in active.takeLast(7).asReversed().withIndex()) {
                    if (index > 0) ProgressDivider()
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(day.date.progressDate(), style = MaterialTheme.typography.titleSmall)
                            if (day.count > 0) ProgressDetail("Записей активности · ${formatNumber(day.count)}")
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            if (day.volumeKg > 0) Text("${formatNumber(day.volumeKg)} кг", style = MaterialTheme.typography.titleSmall)
                            if (day.sets > 0) ProgressDetail("${formatNumber(day.sets)} подх./раунд. · ${formatNumber(day.reps)} повт.")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrainingChart(days: List<ProgressDay>) {
    var showVolume by rememberSaveable { mutableStateOf(true) }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            selected = showVolume,
            onClick = { showVolume = true },
            label = { Text("Объём") },
        )
        FilterChip(
            selected = !showVolume,
            onClick = { showVolume = false },
            label = { Text("Частота") },
        )
    }
    val values = days.map { if (showVolume) it.volumeKg else it.count.toDouble() }
    val maximum = values.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
    val color = MaterialTheme.colorScheme.primary
    val quiet = MaterialTheme.colorScheme.outlineVariant
    val chartTitle = if (showVolume) "Объём по дням" else "Частота активности по дням"
    Row(
        Modifier.fillMaxWidth().height(76.dp).semantics { contentDescription = chartTitle },
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        for (value in values) {
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.BottomCenter) {
                val height = if (value > 0) (76 * value / maximum).coerceAtLeast(4.0) else 2.0
                Box(
                    Modifier.fillMaxWidth().height(height.dp).background(
                        color = if (value > 0) color else quiet,
                        shape = RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp),
                    ),
                )
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        ProgressDetail(days.first().date.progressDate())
        ProgressDetail(days.last().date.progressDate())
    }
}

private fun LazyListScope.measurementSection(
    data: ProgressSnapshot,
    editable: Boolean,
    openEditor: (ProgressEntryKind, LocalDate) -> Unit,
) {
    item("measurement-overview") {
        val weightEntries = data.measurements.filter { it[ProgressField.WEIGHT] != null }
        val latest = weightEntries.firstOrNull()
        val weight = latest?.get(ProgressField.WEIGHT)
        val previous = weightEntries.getOrNull(1)?.get(ProgressField.WEIGHT)
        val change = if (weight != null && previous != null) weight - previous else null
        ProgressHighlight {
            Text("Вес", style = MaterialTheme.typography.titleMedium)
            if (latest != null && weight != null) {
                Text("${formatNumber(weight)} кг", style = MaterialTheme.typography.headlineLarge)
                val difference = change?.takeIf { kotlin.math.abs(it) >= .005 }
                val annotation = difference?.let { " · ${if (it > 0) "+" else ""}${formatNumber(it)} кг" }.orEmpty()
                Text(latest.date.progressDate(includeYear = true) + annotation, style = MaterialTheme.typography.bodyMedium)
            } else {
                Text("Добавьте вес или другие показатели тела.", style = MaterialTheme.typography.bodyMedium)
            }
            Button(onClick = { openEditor(ProgressEntryKind.MEASUREMENT, data.today) }, enabled = editable) {
                Text("Добавить замер")
            }
        }
    }
    if (data.measurements.isNotEmpty()) {
        item("measurement-history") {
            VibeCard {
                Text("История замеров", style = MaterialTheme.typography.titleMedium)
                for ((index, entry) in data.measurements.take(10).withIndex()) {
                    if (index > 0) ProgressDivider()
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(entry.date.progressDate(includeYear = true), style = MaterialTheme.typography.titleSmall)
                        ProgressDetail(entry.fields.entries.joinToString(" · ") { (field, value) ->
                            "${field.label} ${formatNumber(value)} ${field.unit}"
                        })
                        entry.notes?.let { ProgressDetail(it, maxLines = 2) }
                    }
                }
            }
        }
    }
}

private fun LazyListScope.dailySection(
    today: LocalDate,
    todayEntry: ProgressEntry?,
    entries: List<ProgressEntry>,
    kind: ProgressEntryKind,
    editable: Boolean,
    openEditor: (ProgressEntryKind, LocalDate) -> Unit,
) {
    val isSleep = kind == ProgressEntryKind.SLEEP
    item("daily-overview") {
        ProgressHighlight {
            Text("Сегодня · ${today.progressDate()}", style = MaterialTheme.typography.titleMedium)
            if (todayEntry == null) {
                Text(if (isSleep) "Сон ещё не записан" else "Питание ещё не записано", style = MaterialTheme.typography.headlineSmall)
            } else if (isSleep) {
                todayEntry[ProgressField.HOURS]?.let { Text("${formatNumber(it)} ч", style = MaterialTheme.typography.headlineLarge) }
                todayEntry[ProgressField.QUALITY]?.let { Text("Качество сна · ${formatNumber(it)} из 5") }
            } else {
                todayEntry[ProgressField.CALORIES]?.let {
                    Text("${formatNumber(it, 0)} ккал", style = MaterialTheme.typography.headlineLarge)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (field in listOf(ProgressField.PROTEIN, ProgressField.FAT, ProgressField.CARBS)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(todayEntry[field]?.let { "${formatNumber(it)} г" } ?: "—", style = MaterialTheme.typography.titleMedium)
                            Text(field.label, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
            todayEntry?.notes?.let { Text(it, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis) }
            Button(onClick = { openEditor(kind, today) }, enabled = editable) {
                Text(if (todayEntry != null) "Изменить запись" else if (isSleep) "Записать сон" else "Записать питание")
            }
        }
    }
    val history = entries.filterNot { it.date == today }
    item("daily-history") {
        VibeCard {
            Text(if (isSleep) "История сна" else "История питания", style = MaterialTheme.typography.titleMedium)
            if (history.isEmpty()) ProgressDetail("Записей за другие дни пока нет.")
            for ((index, entry) in history.take(10).withIndex()) {
                if (index > 0) ProgressDivider()
                Row(
                    Modifier.fillMaxWidth().clickable(
                        enabled = editable,
                        onClickLabel = "Изменить запись",
                        onClick = { openEditor(kind, entry.date) },
                    ).padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(entry.date.progressDate(includeYear = true), style = MaterialTheme.typography.titleSmall)
                        val detail = if (isSleep) sleepSummary(entry) else nutritionSummary(entry)
                        if (detail.isNotBlank()) ProgressDetail(detail)
                        entry.notes?.let { ProgressDetail(it, maxLines = 2) }
                    }
                    Text("Изменить", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

private fun sleepSummary(entry: ProgressEntry): String = listOfNotNull(
    entry[ProgressField.HOURS]?.let { "${formatNumber(it)} ч" },
    entry[ProgressField.QUALITY]?.let { "${formatNumber(it)} из 5" },
).joinToString(" · ")

private fun nutritionSummary(entry: ProgressEntry): String = listOfNotNull(
    entry[ProgressField.CALORIES]?.let { "${formatNumber(it, 0)} ккал" },
    entry[ProgressField.PROTEIN]?.let { "Б ${formatNumber(it)} г" },
    entry[ProgressField.FAT]?.let { "Ж ${formatNumber(it)} г" },
    entry[ProgressField.CARBS]?.let { "У ${formatNumber(it)} г" },
).joinToString(" · ")

@Composable
private fun ProgressHighlight(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun ProgressFact(value: String, label: String, modifier: Modifier = Modifier) {
    Surface(modifier, color = MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.medium) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall)
            ProgressDetail(label)
        }
    }
}

@Composable
private fun ProgressDetail(text: String, maxLines: Int = Int.MAX_VALUE) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun ProgressDivider() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
