package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private typealias CompanionWrite = (JSONObject, () -> Unit) -> Unit

@Composable
internal fun CompanionScreen(section: String, request: ScreenRequest) {
    val title = when (section) {
        "schedule" -> "Расписание"
        "friends" -> "Друзья"
        "notes" -> "Заметки"
        else -> return
    }

    key(section) {
        var revision by remember { mutableIntStateOf(0) }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var success by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        val path = "/api/mobile/v1/companion/$section"
        val result = loadScreenJson(path, revision, request)
        val data = result.data

        val change: CompanionWrite = { body, onSaved ->
            val accountId = data?.optString("accountId").orEmpty()
            if (!busy && accountId.isNotBlank()) {
                busy = true
                error = null
                success = false
                scope.launch {
                    try {
                        request(path, body.put("accountId", accountId))
                        onSaved()
                        success = true
                        revision++
                    } catch (failure: Exception) {
                        if (failure is CancellationException) throw failure
                        error = companionError(failure)
                    } finally {
                        busy = false
                    }
                }
            }
        }

        VibeList {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    VibeHeading(title)
                    IconButton(onClick = { error = null; success = false; revision++ }, enabled = !busy) {
                        Icon(Icons.Default.Refresh, "Обновить")
                    }
                }
            }
            error?.let { message ->
                item { Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error) }
            }
            if (busy || success) {
                item {
                    Text(
                        if (busy) "Сохраняем…" else "Сохранено",
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (data == null) {
                item { LoadStatus(result) { revision++ } }
            } else {
                when (section) {
                    "schedule" -> companionSchedule(data, busy, change)
                    "friends" -> companionFriends(data, busy, change)
                    "notes" -> companionNotes(data)
                }
            }
        }
    }
}

private fun LazyListScope.companionSchedule(data: JSONObject, busy: Boolean, change: CompanionWrite) {
    val schedules = data.objects("schedules")
    item { CompanionScheduleForm(data.objects("weekdays"), data.objects("presets"), busy, change) }
    item { Text("Ваши напоминания", style = MaterialTheme.typography.headlineSmall) }
    if (schedules.isEmpty()) item { CompanionEmpty("У вас пока нет напоминаний о тренировках.") }
    items(schedules, key = { it.getString("id") }) { schedule -> CompanionScheduleCard(schedule, busy, change) }
}

@Composable
private fun CompanionScheduleForm(
    weekdays: List<JSONObject>,
    presets: List<JSONObject>,
    busy: Boolean,
    change: CompanionWrite,
) {
    var label by remember { mutableStateOf("") }
    var days by remember { mutableStateOf(emptySet<Int>()) }
    var hour by remember { mutableStateOf("18") }
    var preset by remember { mutableStateOf<JSONObject?>(null) }
    var choosePreset by remember { mutableStateOf(false) }
    val reminderHour = hour.toIntOrNull()?.takeIf { it in 0..23 }

    VibeCard {
        Text("Новое напоминание", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            label, { if (it.length <= 60) label = it },
            label = { Text("Тренировка") }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = !busy,
        )
        Text("Дни недели", style = MaterialTheme.typography.labelLarge)
        weekdays.chunked(4).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { day ->
                    val index = day.getInt("iso")
                    FilterChip(
                        selected = index in days,
                        onClick = { days = if (index in days) days - index else days + index },
                        label = { Text(day.getString("short")) },
                        enabled = !busy,
                        modifier = Modifier.semantics { contentDescription = day.getString("full") },
                    )
                }
            }
        }
        OutlinedTextField(
            hour, { if (it.length <= 2 && it.all(Char::isDigit)) hour = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Час напоминания") },
            suffix = { Text(":00") },
            supportingText = { Text("По часовому поясу профиля. Введите час от 0 до 23.") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            enabled = !busy,
            isError = hour.isNotEmpty() && reminderHour == null,
        )
        if (presets.isNotEmpty()) {
            Box {
                OutlinedButton(onClick = { choosePreset = true }, enabled = !busy) {
                    Text(preset?.getString("label") ?: "Привязать тренировку", maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                DropdownMenu(expanded = choosePreset, onDismissRequest = { choosePreset = false }) {
                    DropdownMenuItem(text = { Text("Свободное напоминание") }, onClick = { preset = null; choosePreset = false })
                    presets.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.getString("format") + " · " + option.getString("label")) },
                            onClick = { preset = option; choosePreset = false },
                        )
                    }
                }
            }
        }
        Button(
            enabled = !busy && label.isNotBlank() && days.isNotEmpty() && reminderHour != null,
            onClick = {
                if (reminderHour != null) {
                    val body = JSONObject().put("action", "create").put("label", label.trim())
                        .put("daysOfWeek", JSONArray(days.sorted())).put("hour", reminderHour)
                    preset?.let { body.put("preset", it.getString("value")) }
                    change(body) {
                        label = ""
                        days = emptySet()
                        preset = null
                    }
                }
            },
        ) { Text("Добавить напоминание") }
    }
}

@Composable
private fun CompanionScheduleCard(schedule: JSONObject, busy: Boolean, change: CompanionWrite) {
    val id = schedule.getString("id")
    val label = schedule.getString("label")
    val active = schedule.getBoolean("enabled")
    var deleting by remember(id) { mutableStateOf(false) }
    VibeCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(label, style = MaterialTheme.typography.titleMedium)
                CompanionCaption(schedule.getString("daysLabel") + " · " + schedule.getString("hourLabel"))
                if (!schedule.isNull("presetLabel")) CompanionCaption(schedule.getString("presetLabel"))
            }
            Switch(
                checked = active,
                onCheckedChange = { enabled -> change(JSONObject().put("action", "toggle").put("id", id).put("enabled", enabled)) {} },
                enabled = !busy,
                modifier = Modifier.semantics { contentDescription = "Напоминание $label" },
            )
        }
        TextButton(onClick = { deleting = true }, enabled = !busy) { Text("Удалить") }
    }
    if (deleting) {
        AlertDialog(
            onDismissRequest = { if (!busy) deleting = false },
            properties = DialogProperties(dismissOnBackPress = !busy, dismissOnClickOutside = !busy),
            title = { Text("Удалить напоминание?") },
            text = { Text(label) },
            confirmButton = {
                Button(enabled = !busy, onClick = {
                    val body = JSONObject().put("action", "delete").put("id", id)
                    deleting = false
                    change(body) {}
                }) { Text("Удалить") }
            },
            dismissButton = { TextButton(onClick = { deleting = false }, enabled = !busy) { Text("Отмена") } },
        )
    }
}

private fun LazyListScope.companionFriends(data: JSONObject, busy: Boolean, change: CompanionWrite) {
    item { CompanionInviteForm(busy, change) }
    item {
        VibeCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Делиться программами", style = MaterialTheme.typography.titleMedium)
                    CompanionCaption("Друзья смогут видеть ваши шаблоны и оценки ИИ-тренера.")
                }
                Switch(
                    checked = data.getBoolean("sharesPrograms"),
                    onCheckedChange = { enabled -> change(JSONObject().put("action", "share").put("enabled", enabled)) {} },
                    enabled = !busy,
                    modifier = Modifier.semantics { contentDescription = "Делиться программами с друзьями" },
                )
            }
        }
    }

    val incoming = data.objects("incoming")
    if (incoming.isNotEmpty()) item { Text("Входящие заявки", style = MaterialTheme.typography.headlineSmall) }
    items(incoming, key = { "incoming-" + it.getString("id") }) { invite ->
        VibeCard {
            CompanionFriendLabel(invite)
            FilledTonalButton(enabled = !busy, onClick = {
                change(JSONObject().put("action", "accept").put("id", invite.getString("id"))) {}
            }) { Text("Принять") }
        }
    }

    val outgoing = data.objects("outgoing")
    if (outgoing.isNotEmpty()) item { Text("Исходящие заявки", style = MaterialTheme.typography.headlineSmall) }
    items(outgoing, key = { "outgoing-" + it.getString("id") }) { invite ->
        VibeCard {
            CompanionFriendLabel(invite)
            CompanionCaption("Ожидает ответа")
        }
    }

    val friends = data.objects("friends")
    item { Text("Ваши друзья", style = MaterialTheme.typography.headlineSmall) }
    if (friends.isEmpty()) item { CompanionEmpty("У вас пока нет добавленных друзей.") }
    items(friends, key = { "friend-" + it.getString("id") }) { friend ->
        VibeCard {
            CompanionFriendLabel(friend)
            val event = friend.optJSONObject("lastEvent")
            if (event == null) {
                CompanionCaption("Пока нет завершённых тренировок")
            } else {
                CompanionCaption(event.getString("format") + " · " + formatWorkoutDate(event.getString("startedAt")))
                Text(event.getString("name") + " · " + event.getString("meta"), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun CompanionInviteForm(busy: Boolean, change: CompanionWrite) {
    var email by remember { mutableStateOf("") }
    VibeCard {
        Text("Пригласить друга", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            email, { email = it }, label = { Text("Email друга") }, enabled = !busy, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
        )
        Button(enabled = !busy && email.contains('@'), onClick = {
            change(JSONObject().put("action", "invite").put("email", email.trim())) { email = "" }
        }) { Text("Отправить заявку") }
    }
}

@Composable
private fun CompanionFriendLabel(user: JSONObject) {
    val name = user.getString("name")
    val email = user.getString("email")
    Text(name, style = MaterialTheme.typography.titleMedium)
    if (name != email) CompanionCaption(email)
}

private fun LazyListScope.companionNotes(data: JSONObject) {
    val notes = data.objects("notes")
    if (notes.isEmpty()) item { CompanionEmpty("Здесь появятся заметки к тренировкам, упражнениям и неделям.") }
    items(notes, key = { it.getString("kind") + "-" + it.getString("id") }) { note ->
        var expanded by remember { mutableStateOf(false) }
        val kind = when (note.getString("kind")) {
            "exercise" -> "Упражнение"
            "cycle" -> "Тренировочная неделя"
            else -> "Тренировка"
        }
        val content = note.getString("content")
        VibeCard {
            CompanionCaption(kind + " · " + formatWorkoutDate(note.getString("updatedAt")))
            Text(note.getString("title"), style = MaterialTheme.typography.titleMedium)
            if (expanded) {
                SelectionContainer { Text(content, style = MaterialTheme.typography.bodyMedium) }
            } else {
                Text(content, style = MaterialTheme.typography.bodyMedium, maxLines = 4, overflow = TextOverflow.Ellipsis)
            }
            if (content.isNotBlank()) {
                TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Свернуть" else "Читать заметку") }
            }
        }
    }
}

@Composable
private fun CompanionEmpty(message: String) {
    VibeCard { CompanionCaption(message) }
}

@Composable
private fun CompanionCaption(message: String) {
    Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

private fun companionError(failure: Exception): String {
    val http = failure as? HttpFailure
    return when (http?.reason) {
        "own_email" -> "Укажите email друга."
        "friend_not_found" -> "Пользователь с таким email не найден."
        "request_not_found" -> "Заявка уже недоступна. Обновите список."
        "invalid_input" -> "Проверьте заполненные поля."
        "account_changed" -> "Аккаунт сменился. Откройте раздел снова."
        else -> if (http?.code == 401) "Войдите в аккаунт снова." else "Сервер не подтвердил изменение. Проверьте данные после обновления."
    }
}
