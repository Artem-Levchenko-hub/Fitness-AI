package app.leadgenerator.fitness.nativeapp

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val LIBRARY_PATH = "/api/mobile/v1/library"
private enum class LibraryPage(val title: String) {
    LIST("Библиотека"), PROGRAM("Программа"), DAY("День программы"), CREATE("Собрать план"), AI("План с ИИ"), ARTICLE("Статья"),
}

@Composable
internal fun LibraryScreen(request: ScreenRequest, onStartDay: (TrainingTemplate) -> Unit, starting: Boolean,
    onSubscription: () -> Unit = {}, onEditTemplate: (String) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var page by rememberSaveable { mutableStateOf(LibraryPage.LIST) }
    var programId by rememberSaveable { mutableStateOf("") }
    var dayId by rememberSaveable { mutableStateOf("") }
    var articleId by rememberSaveable { mutableStateOf("") }
    var refresh by remember { mutableIntStateOf(0) }
    var saving by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }

    val path = when (page) {
        LibraryPage.LIST -> LIBRARY_PATH
        LibraryPage.PROGRAM -> "$LIBRARY_PATH?programId=$programId"
        LibraryPage.DAY -> "$LIBRARY_PATH?programId=$programId&dayId=$dayId"
        LibraryPage.CREATE -> "$LIBRARY_PATH?new=1"
        LibraryPage.AI -> "$LIBRARY_PATH?ai=1"
        LibraryPage.ARTICLE -> "$LIBRARY_PATH?articleId=$articleId"
    }
    val result = key(path) { loadScreenJson(path, refresh, request) }
    val data = result.data

    fun goTo(next: LibraryPage) {
        actionError = null
        page = next
    }

    fun goBack() {
        if (saving) return
        goTo(if (page == LibraryPage.DAY) LibraryPage.PROGRAM else LibraryPage.LIST)
    }

    fun openProgram(id: String) {
        programId = id
        goTo(LibraryPage.PROGRAM)
    }

    fun mutate(payload: JSONObject, onSuccess: (JSONObject) -> Unit) {
        if (saving || data == null) return
        actionError = null
        saving = true
        payload.put("accountId", data.getString("accountId"))
        scope.launch {
            try {
                onSuccess(request(LIBRARY_PATH, payload))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: HttpFailure) {
                actionError = when (failure.reason) {
                    "account_changed", "sign_in_required" -> "Войдите снова и откройте библиотеку."
                    "template_not_found" -> "Один из шаблонов больше недоступен. Откройте список заново."
                    "program_not_found" -> "Эта программа больше недоступна."
                    "invalid_program" -> "Проверьте название и выбранные шаблоны."
                    "subscription_required" -> "Для персонального плана нужна активная подписка Pro."
                    "ai_quota_exceeded" -> "Лимит ИИ-операций по вашему тарифу на этот месяц исчерпан."
                    "ai_rate_limited" -> "Подождите минуту перед следующим запросом."
                    "ai_request_in_progress" -> "Тренер ещё составляет план. Через несколько секунд повторите запрос."
                    "ai_unavailable", "exercise_catalog_empty" -> "ИИ-планы сейчас недоступны. Попробуйте позже."
                    "ai_generation_failed" -> "Тренер не смог составить план. Попробуйте ещё раз через минуту."
                    else -> "Не удалось сохранить. Попробуйте ещё раз."
                }
            } catch (_: Exception) {
                actionError = "Не удалось сохранить. Проверьте подключение."
            } finally {
                saving = false
            }
        }
    }

    BackHandler(enabled = page != LibraryPage.LIST, onBack = ::goBack)
    if (page == LibraryPage.CREATE && data != null) {
        LibraryProgramBuilder(data.objects("templates"), saving, actionError, ::goBack) { payload ->
            mutate(payload) { openProgram(it.getString("programId")) }
        }
        return
    }
    if (page == LibraryPage.AI && data != null) {
        AiProgramBuilder(data.optBoolean("aiConfigured"), saving, actionError, ::goBack, onSubscription) { payload ->
            mutate(payload) { openProgram(it.getString("programId")) }
        }
        return
    }

    VibeList {
        if (page != LibraryPage.LIST) {
            item("library-back") {
                LibraryBack(if (page == LibraryPage.DAY) "К программе" else "К библиотеке", ::goBack, enabled = !saving)
            }
        }
        if (data == null) {
            item("library-heading") { VibeHeading(page.title) }
            item("library-load") { LoadStatus(result) { refresh++ } }
        } else {
            when (page) {
                LibraryPage.LIST -> libraryPrograms(
                    programs = data.objects("programs"),
                    articles = data.objects("articles"),
                    onProgram = ::openProgram,
                    onCreate = { goTo(LibraryPage.CREATE) },
                    onAi = { goTo(LibraryPage.AI) },
                    onArticle = { id ->
                        articleId = id
                        goTo(LibraryPage.ARTICLE)
                    },
                )
                LibraryPage.PROGRAM -> libraryProgram(
                    program = data.getJSONObject("program"),
                    saving = saving,
                    error = actionError,
                    onChangeActive = { active ->
                        mutate(JSONObject().put("action", "set_active").put("programId", programId).put("active", active)) {
                            refresh++
                        }
                    },
                    onDay = { id ->
                        dayId = id
                        goTo(LibraryPage.DAY)
                    },
                )
                LibraryPage.DAY -> {
                    libraryDay(data.getJSONObject("day"), onStartDay, starting)
                    item("edit-program-day") { OutlinedButton(onClick = { onEditTemplate(dayId) }, enabled = !starting) { Text("Редактировать день") } }
                }
                LibraryPage.CREATE, LibraryPage.AI -> Unit
                LibraryPage.ARTICLE -> libraryArticle(data.getJSONObject("article"))
            }
        }
    }
}

private fun LazyListScope.libraryPrograms(
    programs: List<JSONObject>,
    articles: List<JSONObject>,
    onProgram: (String) -> Unit,
    onCreate: () -> Unit,
    onAi: () -> Unit,
    onArticle: (String) -> Unit,
) {
    item("library-title") { VibeHeading("Библиотека") }
    item("ai-plan") {
        VibeCard {
            Text("Ваш план с ИИ-тренером", style = MaterialTheme.typography.headlineSmall)
            LibraryDetail("Цель, опыт и доступный инвентарь — тренер подберёт упражнения, повторы и отдых. Доступно с Pro.")
            Button(onClick = onAi, modifier = Modifier.fillMaxWidth()) { Text("Составить план с ИИ") }
        }
    }
    item("library-controls") {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Мои планы", Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall)
            if (programs.isNotEmpty()) TextButton(onClick = onCreate) { Text("Собрать план") }
        }
    }
    if (programs.isEmpty()) {
        item("empty-library") {
            VibeCard {
                Text("Планов пока нет", style = MaterialTheme.typography.titleMedium)
                LibraryDetail("Выберите свои шаблоны, чтобы объединить тренировки в программу.")
                Button(onClick = onCreate) { Text("Собрать план") }
            }
        }
    }
    items(programs, key = { it.getString("id") }) { program ->
        val active = program.getBoolean("active")
        LibraryRow(
            title = program.getString("name"),
            detail = "${program.getInt("dayCount")} дн. · ${if (active) "Активна" else "На полке"}",
            onClick = { onProgram(program.getString("id")) },
        )
    }
    if (articles.isNotEmpty()) item("articles-heading") { Text("Статьи", style = MaterialTheme.typography.headlineSmall) }
    items(articles, key = { it.getString("id") }) { article ->
        LibraryRow(article.getString("title"), article.getString("summary")) {
            onArticle(article.getString("id"))
        }
    }
}

private fun LazyListScope.libraryArticle(article: JSONObject) {
    item("article-heading") { VibeHeading(article.getString("title"), article.getString("summary")) }
    item("article-body") {
        VibeCard {
            for (section in article.objects("sections")) {
                Text(section.getString("title"), style = MaterialTheme.typography.titleMedium)
                Text(section.getString("text"), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

private fun LazyListScope.libraryProgram(
    program: JSONObject,
    saving: Boolean,
    error: String?,
    onChangeActive: (Boolean) -> Unit,
    onDay: (String) -> Unit,
) {
    val active = program.getBoolean("active")
    val days = program.objects("days")
    item("program-heading") {
        VibeHeading(program.getString("name"), program.libraryText("description"))
    }
    item("program-status") {
        VibeCard {
            Text(if (active) "Программа активна" else "Программа на полке", style = MaterialTheme.typography.titleMedium)
            if (active) {
                OutlinedButton(onClick = { onChangeActive(false) }, enabled = !saving) {
                    Text(if (saving) "Обновляем…" else "Убрать из активных")
                }
            } else {
                Button(onClick = { onChangeActive(true) }, enabled = !saving) {
                    Text(if (saving) "Обновляем…" else "Активировать")
                }
            }
            error?.let { LibraryError(it) }
        }
    }
    program.optJSONObject("review")?.let { review ->
        item("program-review") {
            VibeCard {
                Text("Оценка тренера · ${review.optInt("score")}/100", style = MaterialTheme.typography.titleMedium)
                review.libraryText("summary")?.let { LibraryDetail(it) }
                val recommendations = review.optJSONArray("recommendations")
                if (recommendations != null && recommendations.length() > 0) {
                    Text("Рекомендации", style = MaterialTheme.typography.labelLarge)
                    for (index in 0 until recommendations.length()) {
                        LibraryDetail("• ${recommendations.getString(index)}")
                    }
                }
            }
        }
    }
    item("program-days") { Text("Дни программы", style = MaterialTheme.typography.headlineSmall) }
    if (days.isEmpty()) item("empty-days") { VibeCard { LibraryDetail("В программе пока нет тренировочных дней.") } }
    items(days, key = { it.getString("templateId") }) { day ->
        val adapted = if (day.optBoolean("adapted")) " · Адаптирован" else ""
        LibraryRow(day.getString("name"), "${day.getInt("exerciseCount")} упр.$adapted", enabled = !saving) {
            onDay(day.getString("templateId"))
        }
    }
}

private fun LazyListScope.libraryDay(day: JSONObject, onStartDay: (TrainingTemplate) -> Unit, starting: Boolean) {
    val id = day.getString("id")
    val name = day.getString("name")
    val exercises = day.objects("items")
    item("day-heading") { VibeHeading(name, day.libraryText("description")) }
    item("day-start") {
        Button(
            onClick = { onStartDay(TrainingTemplate(id, name, exercises.size)) },
            modifier = Modifier.fillMaxWidth(),
            enabled = exercises.isNotEmpty() && !starting,
        ) { Text(if (starting) "Начинаем…" else "Начать тренировку") }
    }
    item("day-exercises") {
        VibeCard {
            Text("Упражнения", style = MaterialTheme.typography.titleMedium)
            if (exercises.isEmpty()) LibraryDetail("В этом дне пока нет упражнений.")
            for ((index, exercise) in exercises.withIndex()) {
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(exercise.getString("name"), style = MaterialTheme.typography.titleSmall)
                    val sets = exercise.getInt("sets")
                    val repsMin = exercise.getInt("repsMin")
                    val repsMax = exercise.getInt("repsMax")
                    val reps = if (repsMin == repsMax) "$repsMin" else "$repsMin–$repsMax"
                    val weight = exercise.optDouble("weightKg").takeIf(Double::isFinite)
                        ?.let { " · ${formatNumber(it)} кг" }.orEmpty()
                    val myo = exercise.optJSONObject("myo")
                    if (myo == null) {
                        LibraryDetail("$sets × $reps$weight · отдых ${exercise.getInt("restSeconds")} с")
                    } else {
                        LibraryDetail("Мио-репсы · $reps + ${myo.optInt("miniSets")} × ${myo.optInt("miniReps")}$weight")
                        LibraryDetail("Отдых между мини-сетами · ${myo.optInt("restSeconds")} с")
                    }
                    exercise.libraryText("notes")?.let { LibraryDetail(it) }
                }
            }
        }
    }
}

@Composable
private fun LibraryProgramBuilder(
    templates: List<JSONObject>,
    saving: Boolean,
    error: String?,
    onBack: () -> Unit,
    onCreate: (JSONObject) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf(arrayListOf<String>()) }
    var clientId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    val templatesById = templates.associateBy { it.getString("id") }
    val chosen = selected.filter(templatesById::containsKey)

    VibeList {
        item("builder-back") { LibraryBack("К библиотеке", onBack, enabled = !saving) }
        item("builder-heading") { VibeHeading("Собрать план") }
        if (templates.isEmpty()) {
            item("builder-empty") {
                VibeCard { LibraryDetail("Создайте шаблон в разделе «Тренировки», чтобы добавить день в план.") }
            }
        } else {
            item("builder-fields") {
                VibeCard {
                    OutlinedTextField(
                        name, onValueChange = {
                            name = it.take(80)
                            clientId = UUID.randomUUID().toString()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Название") },
                        singleLine = true,
                        enabled = !saving,
                    )
                    OutlinedTextField(
                        description, onValueChange = {
                            description = it.take(500)
                            clientId = UUID.randomUUID().toString()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Описание") },
                        maxLines = 3,
                        enabled = !saving,
                    )
                    LibraryDetail("Дни идут в том порядке, в котором вы выбираете шаблоны.")
                    for ((index, id) in chosen.withIndex()) {
                        Text("${index + 1}. ${templatesById.getValue(id).getString("name")}",
                            style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            items(templates, key = { it.getString("id") }) { template ->
                val id = template.getString("id")
                val checked = id in selected
                val toggle = {
                    selected = ArrayList(if (checked) selected - id else selected + id)
                    clientId = UUID.randomUUID().toString()
                }
                Surface(
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                ) {
                    Row(
                        Modifier.fillMaxWidth()
                            .toggleable(checked, enabled = !saving, role = Role.Checkbox, onValueChange = { toggle() })
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(template.getString("name"), style = MaterialTheme.typography.titleMedium)
                            LibraryDetail("${template.getInt("exerciseCount")} упр.")
                        }
                        Checkbox(checked, onCheckedChange = null, enabled = !saving)
                    }
                }
            }
            item("builder-save") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    error?.let { LibraryError(it) }
                    Button(
                        onClick = {
                            onCreate(JSONObject().put("action", "create").put("name", name.trim())
                                .put("description", description.trim()).put("clientProgramId", clientId)
                                .put("templateIds", JSONArray(chosen)))
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !saving && name.trim().length >= 2 && chosen.isNotEmpty(),
                    ) { Text(if (saving) "Сохраняем…" else "Создать программу") }
                }
            }
        }
    }
}

@Composable
private fun LibraryRow(title: String, detail: String, enabled: Boolean = true, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                LibraryDetail(detail)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun LibraryBack(label: String, onBack: () -> Unit, enabled: Boolean) {
    TextButton(onClick = onBack, enabled = enabled) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(18.dp))
            Text(label)
        }
    }
}

@Composable
private fun LibraryDetail(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun LibraryError(text: String) {
    Text(text, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error)
}

private fun JSONObject.libraryText(field: String): String? =
    optString(field).takeIf { !isNull(field) && it.isNotBlank() }
