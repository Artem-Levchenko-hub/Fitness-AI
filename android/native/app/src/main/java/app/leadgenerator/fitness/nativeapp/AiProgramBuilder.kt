package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import org.json.JSONObject
import java.util.UUID

@Composable
internal fun AiProgramBuilder(configured: Boolean, saving: Boolean, error: String?, onBack: () -> Unit,
    onSubscription: () -> Unit, onSubmit: (JSONObject) -> Unit) {
    var goal by rememberSaveable { mutableStateOf("") }
    var experience by rememberSaveable { mutableStateOf("") }
    var schedule by rememberSaveable { mutableStateOf("") }
    var equipment by rememberSaveable { mutableStateOf("") }
    var limitations by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var requestId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    fun changed() { requestId = UUID.randomUUID().toString() }

    VibeList {
        item { TextButton(onClick = onBack, enabled = !saving) { Text("К библиотеке") } }
        item { VibeHeading("Составим план под вас", "Ответьте своими словами. Тренер учтёт цель, время и ограничения.") }
        if (!configured) {
            item { VibeCard { Text("ИИ-тренер сейчас недоступен. Вернитесь позже или соберите план из своих шаблонов.") } }
        } else {
            item { AiQuestion("1 · Ваша цель *", "Например: набрать мышцы и стать сильнее", goal, saving) { goal = it; changed() } }
            item { AiQuestion("2 · Опыт тренировок", "Как давно занимаетесь, какие движения знакомы", experience, saving) { experience = it; changed() } }
            item { AiQuestion("3 · Время и график", "Например: 3 раза в неделю по часу", schedule, saving) { schedule = it; changed() } }
            item { AiQuestion("4 · Место и инвентарь", "Зал, дом, гантели или собственный вес", equipment, saving) { equipment = it; changed() } }
            item { AiQuestion("5 · Травмы и ограничения", "Что нужно учесть при выборе упражнений", limitations, saving) { limitations = it; changed() } }
            item { AiQuestion("6 · Пожелания", "Любимые упражнения, акценты или исключения", notes, saving) { notes = it; changed() } }
            item {
                VibeCard {
                    Text("Персональный план · Pro", style = MaterialTheme.typography.titleMedium)
                    Text("Использует одну ИИ-операцию из вашего тарифа. После создания план появится в библиотеке и будет готов к тренировке.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (saving) {
                        LinearProgressIndicator(Modifier.fillMaxWidth())
                        Text("Тренер подбирает упражнения… Обычно это занимает до минуты.")
                    }
                    if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
                    Button(enabled = !saving && goal.trim().length >= 2, modifier = Modifier.fillMaxWidth(), onClick = {
                        val intake = JSONObject().put("goal", goal.trim()).put("experience", experience.trim())
                            .put("schedule", schedule.trim()).put("equipment", equipment.trim())
                            .put("limitations", limitations.trim()).put("notes", notes.trim())
                        onSubmit(JSONObject().put("action", "ai_create").put("clientProgramId", requestId).put("intake", intake))
                    }) { Text(if (saving) "Составляем план…" else "Составить план") }
                    OutlinedButton(enabled = !saving, onClick = onSubscription, modifier = Modifier.fillMaxWidth()) { Text("Подписка и лимиты") }
                }
            }
        }
    }
}

@Composable
private fun AiQuestion(title: String, hint: String, value: String, saving: Boolean, onChange: (String) -> Unit) {
    VibeCard {
        Text(title, style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(value, { onChange(it.take(600)) }, Modifier.fillMaxWidth(), placeholder = { Text(hint) },
            enabled = !saving, minLines = 2, supportingText = { Text("${value.length} / 600") })
    }
}
