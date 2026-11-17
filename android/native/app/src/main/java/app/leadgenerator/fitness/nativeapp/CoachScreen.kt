package app.leadgenerator.fitness.nativeapp

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.util.UUID

internal data class CoachWorkout(val id: String, val name: String, val exercises: List<Exercise>) {
    companion object {
        val Saver = listSaver<CoachWorkout?, String>(
            save = { workout ->
                if (workout == null) emptyList() else listOf(workout.id, workout.name) +
                    workout.exercises.flatMap { listOf(it.id, it.name) }
            },
            restore = { items ->
                CoachWorkout(items[0], items[1], items.drop(2).chunked(2).map { (id, name) ->
                    Exercise(id, name, emptyList())
                })
            },
        )
    }
}

@Composable
internal fun WorkoutDetails(workoutId: String, weightUnit: String, request: ScreenRequest, onCoach: (CoachWorkout) -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/journal/workouts/$workoutId", refresh, request)
    val workout = result.data?.optJSONObject("workout")?.let(Workout::fromJson)
    VibeList {
        if (workout == null) {
            item { VibeHeading("Тренировка") }
            item { LoadStatus(result) { refresh++ } }
        } else {
            item { VibeHeading(workout.name, formatWorkoutDate(workout.startedAt).ifBlank { null }) }
            if (workout.status == "completed") {
                item {
                    Button(onClick = { onCoach(CoachWorkout(workout.id, workout.name, workout.exercises)) }) {
                        Text("Разбор и AI-коуч")
                    }
                }
            }
            items(workout.exercises, key = { it.id }) { exercise ->
                VibeCard {
                    Text(exercise.name, style = MaterialTheme.typography.titleLarge)
                    if (exercise.sets.isEmpty()) Text("Подходов нет", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    exercise.sets.forEachIndexed { index, set -> Text("${index + 1}.  ${displayWeight(set.weight, weightUnit)} × ${set.reps}") }
                }
            }
        }
    }
}

@Composable
internal fun CoachScreen(
    workout: CoachWorkout,
    request: ScreenRequest,
    onMessage: suspend (JSONObject) -> String,
    onVideo: suspend (String, String, String, ByteArray) -> JSONObject,
    videoBusy: Boolean,
    onVideoBusy: (Boolean) -> Unit,
) {
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/coach?workoutId=${workout.id}", refresh, request)
    val data = result.data
    var selectedPage by rememberSaveable { mutableStateOf(CoachPage.Review) }
    var draft by rememberSaveable { mutableStateOf("") }
    var draftId by rememberSaveable { mutableStateOf("") }
    var jobId by rememberSaveable { mutableStateOf<String?>(null) }
    var poll by remember { mutableIntStateOf(0) }
    var awaitingReview by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var localReply by remember { mutableStateOf<Pair<String, String>?>(null) }
    var savedJobAnalysis by remember { mutableStateOf<String?>(null) }
    var videoAnalysis by rememberSaveable { mutableStateOf("") }
    var videoError by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(jobId, poll) {
        val id = jobId ?: return@LaunchedEffect
        awaitingReview = true
        try {
            repeat(20) {
                delay(2500)
                val job = request("/api/ai/jobs/$id", null)
                when (job.optString("status")) {
                    "succeeded" -> {
                        savedJobAnalysis = job.optJSONObject("analysis")?.optString("content")
                        jobId = null
                        refresh++
                        return@LaunchedEffect
                    }
                    "failed" -> {
                        jobId = null
                        error = "Разбор не готов. Проверьте доступ к AI и повторите позже."
                        return@LaunchedEffect
                    }
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            error = "Не удалось проверить статус разбора."
        } finally {
            awaitingReview = false
        }
    }

    val storedMessages = data?.objects("messages").orEmpty()
    VibeList {
        item { VibeHeading("AI-тренер", workout.name) }
        if (data == null) {
            item { LoadStatus(result) { refresh++ } }
        } else {
            item {
                val tabs = CoachPage.entries.filter { it != CoachPage.Video || data.optBoolean("videoAvailable") }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    tabs.forEach { tab ->
                        val select = { selectedPage = tab; error = "" }
                        if (selectedPage == tab) FilledTonalButton(onClick = select, enabled = !videoBusy) { Text(tab.label) }
                        else TextButton(onClick = select, enabled = !videoBusy) { Text(tab.label) }
                    }
                }
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            }
            when (selectedPage) {
                CoachPage.Review -> {
                    val analysis = data.takeUnless { it.isNull("analysis") }?.optString("analysis") ?: savedJobAnalysis
                    if (!analysis.isNullOrBlank()) item { VibeCard { ReadableResponse(analysis) } }
                    else item {
                        VibeCard {
                            Text(if (jobId == null) "Разбор тренировки" else "Разбор готовится", style = MaterialTheme.typography.headlineSmall)
                            if (jobId != null) {
                                if (awaitingReview) Text("Проверяем статус…")
                                else TextButton(onClick = { refresh++; poll++ }) { Text("Проверить статус") }
                            } else if (data.optBoolean("coachAvailable")) {
                                Button(enabled = !sending, onClick = {
                                    sending = true
                                    error = ""
                                    scope.launch {
                                        try {
                                            val response = request("/api/ai/trainer", JSONObject().put("workoutId", workout.id))
                                            jobId = response.getString("jobId")
                                        } catch (cancelled: CancellationException) {
                                            throw cancelled
                                        } catch (_: Exception) {
                                            error = "Не удалось запустить разбор."
                                        } finally {
                                            sending = false
                                        }
                                    }
                                }) { Text("Запустить разбор") }
                            } else Text("AI-тренер временно недоступен.")
                        }
                    }
                }
                CoachPage.Chat -> {
                    items(storedMessages, key = { it.getString("id") }) { message ->
                        ConversationMessage(message.optString("role"), message.optString("content"))
                    }
                    localReply?.let { (question, reply) ->
                        if (storedMessages.none { it.optString("content") == reply && it.optString("role") == "assistant" }) {
                            if (storedMessages.none { it.optString("content") == question }) item { ConversationMessage("user", question) }
                            item { ConversationMessage("assistant", reply) }
                        }
                    }
                    item {
                        VibeCard {
                            OutlinedTextField(draft, { draft = it.take(8000); draftId = "" }, Modifier.fillMaxWidth(),
                                label = { Text("Вопрос о тренировке") }, enabled = !sending && data.optBoolean("coachAvailable"), maxLines = 4)
                            Button(enabled = !sending && draft.isNotBlank() && data.optBoolean("coachAvailable"), onClick = {
                                sending = true
                                error = ""
                                val message = draft.trim()
                                if (draftId.isEmpty()) draftId = UUID.randomUUID().toString()
                                scope.launch {
                                    try {
                                        val answer = onMessage(JSONObject().put("workoutId", workout.id)
                                            .put("clientMessageId", draftId).put("message", message))
                                        if (answer.isBlank()) throw IOException("Empty coach reply")
                                        localReply = message to answer
                                        draft = ""
                                        draftId = ""
                                        refresh++
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (failure: Exception) {
                                        error = aiError(failure, "Не удалось получить ответ коуча.")
                                    } finally {
                                        sending = false
                                    }
                                }
                            }) { Text(if (sending) "Готовим ответ…" else "Отправить") }
                            if (storedMessages.any { it.optString("role") == "assistant" }) {
                                TextButton(enabled = !sending, onClick = {
                                    sending = true
                                    scope.launch {
                                        try {
                                            val transcript = JSONArray()
                                            var total = 0
                                            for (entry in storedMessages.takeLast(32).asReversed()) {
                                                val content = entry.optString("content").take(8000).trim()
                                                if (total + content.length > 24000) break
                                                if (content.isNotEmpty()) {
                                                    total += content.length
                                                    transcript.put(JSONObject().put("role", entry.optString("role")).put("content", content))
                                                }
                                            }
                                            val ordered = JSONArray()
                                            for (index in transcript.length() - 1 downTo 0) ordered.put(transcript.getJSONObject(index))
                                            request("/api/ai/coach/finalize", JSONObject().put("workoutId", workout.id).put("messages", ordered))
                                            selectedPage = CoachPage.Review
                                            refresh++
                                        } catch (cancelled: CancellationException) {
                                            throw cancelled
                                        } catch (failure: Exception) {
                                            error = aiError(failure, "Не удалось сохранить итог.")
                                        } finally {
                                            sending = false
                                        }
                                    }
                                }) { Text("Сохранить итог") }
                            }
                        }
                    }
                }
                CoachPage.Video -> Unit
            }
        }
        if (selectedPage == CoachPage.Video && data?.optBoolean("videoAvailable") != false) {
            item("video-technique") {
                VideoTechniquePanel(workout, enabled = data != null, pending = videoBusy,
                    analysis = videoAnalysis, error = videoError, onResult = { analysis, error ->
                        videoAnalysis = analysis
                        videoError = error
                    }, onSubmit = { exerciseId, requestId, readVideo, removeClip ->
                        onVideoBusy(true)
                        videoError = ""
                        videoAnalysis = ""
                        scope.launch {
                            try {
                                val bytes = withContext(Dispatchers.IO) { readVideo() }
                                videoAnalysis = onVideo(workout.id, exerciseId, requestId, bytes).getString("analysis")
                                removeClip()
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (failure: Exception) {
                                videoError = aiError(failure, "Не удалось разобрать видео. Выберите короткий MP4 и повторите.")
                            } finally {
                                onVideoBusy(false)
                            }
                        }
                    })
            }
        }
    }
}

private enum class CoachPage(val label: String) { Review("Разбор"), Chat("Чат"), Video("Видео") }

@Composable
private fun ConversationMessage(role: String, content: String) {
    VibeCard {
        Text(if (role == "user") "Вы" else "Коуч", style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary)
        ReadableResponse(content)
    }
}

@Composable
private fun ReadableResponse(content: String) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        for (line in content.lines().filter { it.isNotBlank() }) {
            val heading = line.startsWith("#")
            Text(
                line.trimStart('#').trimStart().replace("**", "").trim('_'),
                style = if (heading) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun VideoTechniquePanel(
    workout: CoachWorkout,
    enabled: Boolean,
    pending: Boolean,
    analysis: String,
    error: String,
    onResult: (String, String) -> Unit,
    onSubmit: (String, String, () -> ByteArray, () -> Unit) -> Unit,
) {
    val context = LocalContext.current
    val resolver = context.contentResolver
    var exerciseId by rememberSaveable { mutableStateOf(workout.exercises.firstOrNull()?.id.orEmpty()) }
    var uriText by rememberSaveable { mutableStateOf<String?>(null) }
    var capturePath by rememberSaveable { mutableStateOf<String?>(null) }
    var ownClip by rememberSaveable { mutableStateOf<String?>(null) }
    var requestId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { selected ->
        if (selected != null) {
            ownClip?.let { File(it).delete() }
            ownClip = null
            uriText = selected.toString()
            requestId = UUID.randomUUID().toString()
            onResult("", "")
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { recorded ->
        val file = capturePath?.let(::File)
        capturePath = null
        if (recorded && file != null && file.isFile) {
            ownClip?.let { File(it).delete() }
            ownClip = file.path
            uriText = clipUri(context, file).toString()
            requestId = UUID.randomUUID().toString()
            onResult("", "")
        } else {
            file?.delete()
        }
    }

    VibeCard {
        Text("Техника по видео", style = MaterialTheme.typography.headlineSmall)
        Text("Выберите один подход. MP4 до 7 МБ.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        workout.exercises.forEach { exercise ->
            if (exercise.id == exerciseId) FilledTonalButton(onClick = {}, enabled = false) { Text(exercise.name) }
            else TextButton(enabled = enabled && !pending, onClick = {
                exerciseId = exercise.id
                requestId = UUID.randomUUID().toString()
                onResult("", "")
            }) { Text(exercise.name) }
        }
        FilledTonalButton(enabled = enabled && !pending, onClick = {
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly))
        }) { Text(if (uriText == null) "Выбрать видео" else "Выбрать другое видео") }
        TextButton(enabled = enabled && !pending && capturePath == null, onClick = {
            val directory = File(context.cacheDir, "technique-clips")
            try {
                directory.mkdirs()
                directory.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86_400_000L }?.forEach { it.delete() }
                val clip = File.createTempFile("approach-", ".mp4", directory)
                capturePath = clip.path
                camera.launch(clipUri(context, clip))
            } catch (_: Exception) {
                capturePath?.let { File(it).delete() }
                capturePath = null
                onResult(analysis, "Не удалось открыть камеру. Можно выбрать готовый ролик.")
            }
        }) { Text("Снять подход") }
        val selected = uriText?.let(Uri::parse)
        if (selected != null) {
            Text("Видео передаётся AITUNNEL и Alibaba для анализа.", style = MaterialTheme.typography.bodySmall)
            Button(enabled = enabled && exerciseId.isNotBlank() && !pending, onClick = {
                onSubmit(exerciseId, requestId, { readClip(resolver, selected) }) {
                    ownClip?.let { File(it).delete() }
                    ownClip = null
                    uriText = null
                }
            }) { Text(if (pending) "Разбираем видео…" else "Разобрать технику") }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        if (analysis.isNotBlank()) ReadableResponse(analysis)
    }
}

private const val MaxClip = 7 * 1024 * 1024
private fun clipUri(context: Context, clip: File): Uri = FileProvider.getUriForFile(context, "${context.packageName}.capture", clip)

private fun readClip(resolver: ContentResolver, uri: Uri): ByteArray {
    val video = resolver.openInputStream(uri)?.use { stream ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(32 * 1024)
        while (true) {
            val count = stream.read(buffer)
            if (count == -1) break
            if (output.size() + count > MaxClip) throw HttpFailure(413)
            output.write(buffer, 0, count)
        }
        output.toByteArray()
    } ?: throw IOException("Clip is unavailable")
    if (video.size < 16 || video.decodeToString(4, 8) != "ftyp") throw HttpFailure(400, "invalid_video")
    return video
}

private fun aiError(failure: Exception, fallback: String): String = when ((failure as? HttpFailure)?.code) {
    401 -> "Войдите снова."
    402 -> "Недостаточно средств для ответа."
    403 -> "Для этой операции нужна подписка Pro."
    409 -> "Этот ролик уже отправлен."
    413 -> "Размер видео превышает 7 МБ."
    429 -> "Лимит AI исчерпан или запросы идут слишком часто."
    else -> fallback
}
