package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

@Composable
internal fun ProfileSettings(accountId: String, request: ScreenRequest, onSaved: () -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/profile", refresh, request)
    val profile = result.data?.optJSONObject("profile")
    VibeList {
        item { VibeHeading("Настройки профиля") }
        item {
            if (profile == null) LoadStatus(result) { refresh++ }
            else key(accountId) { ProfileForm(profile, accountId, request, onSaved) }
        }
    }
}

@Composable
private fun ProfileForm(profile: JSONObject, accountId: String, request: ScreenRequest, onSaved: () -> Unit) {
    fun field(name: String, fallback: String = "") = if (profile.isNull(name)) fallback else profile.optString(name, fallback)
    var height by rememberSaveable { mutableStateOf(field("heightCm")) }
    var birthday by rememberSaveable { mutableStateOf(field("birthDate").take(10)) }
    var timezone by rememberSaveable { mutableStateOf(field("timezone", "Europe/Moscow")) }
    var weightUnit by rememberSaveable { mutableStateOf(field("weightUnitPref", "kg")) }
    var sex by rememberSaveable { mutableStateOf(field("sex")) }
    var experience by rememberSaveable { mutableStateOf(field("experience", "intermediate")) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    VibeCard {
        Text("Общие данные", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(height, { height = it.take(3) }, Modifier.fillMaxWidth(), label = { Text("Рост, см") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, enabled = !saving)
        OutlinedTextField(birthday, { birthday = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Дата рождения") },
            placeholder = { Text("ГГГГ-ММ-ДД") }, singleLine = true, enabled = !saving)
        ChoiceGroup("Пол", sex, mapOf("male" to "Мужской", "female" to "Женский", "other" to "Другой", "" to "Не указан")) { sex = it }
        ChoiceGroup("Опыт", experience, mapOf("beginner" to "Начинающий", "intermediate" to "Средний", "advanced" to "Продвинутый")) { experience = it }
        ChoiceGroup("Единицы веса", weightUnit, mapOf("kg" to "Килограммы", "lb" to "Фунты")) { weightUnit = it }
        OutlinedTextField(timezone, { timezone = it.take(100) }, Modifier.fillMaxWidth(), label = { Text("Часовой пояс") },
            placeholder = { Text("Europe/Moscow") }, singleLine = true, enabled = !saving)
        Button(enabled = !saving, onClick = {
            error = ""
            val parsedHeight = height.toIntOrNull()
            val dateValid = birthday.isBlank() || runCatching { LocalDate.parse(birthday) <= LocalDate.now() }.getOrDefault(false)
            val zoneValid = runCatching { ZoneId.of(timezone.trim()) }.isSuccess
            if ((height.isNotBlank() && (parsedHeight == null || parsedHeight !in 100..250)) || !dateValid || !zoneValid) {
                error = "Проверьте рост, дату рождения и часовой пояс."
                return@Button
            }
            saving = true
            scope.launch {
                try {
                    val values = JSONObject().put("heightCm", height).put("birthDate", birthday).put("timezone", timezone.trim())
                        .put("weightUnitPref", weightUnit).put("sex", sex).put("experience", experience)
                    request("/api/mobile/v1/profile", JSONObject().put("accountId", accountId).put("profile", values))
                    onSaved()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    error = "Не удалось сохранить настройки."
                } finally {
                    saving = false
                }
            }
        }) { Text(if (saving) "Сохраняем…" else "Сохранить") }
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChoiceGroup(title: String, value: String, choices: Map<String, String>, onSelect: (String) -> Unit) {
    Text(title, style = MaterialTheme.typography.titleMedium)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        choices.forEach { (key, label) ->
            FilterChip(selected = value == key, onClick = { onSelect(key) }, label = { Text(label) })
        }
    }
}
