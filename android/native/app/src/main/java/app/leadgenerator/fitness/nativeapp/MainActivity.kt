package app.leadgenerator.fitness.nativeapp

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

class MainActivity : ComponentActivity() {
    private val app get() = application as JournalApplication
    private val state = MutableStateFlow<JournalState?>(null)
    private val bootstrapping = MutableStateFlow(false)
    private var busy by mutableStateOf(false)
    private var error by mutableStateOf("")
    private var codeSentTo by mutableStateOf<String?>(null)
    private var signingInAgain by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        codeSentTo = savedInstanceState?.getString("codeSentTo")
        signingInAgain = savedInstanceState?.getBoolean("signingInAgain") == true
        enableEdgeToEdge()
        lifecycleScope.launch {
            app.store.changes.collect {
                val (journalState, awaitingJournal) = io {
                    val cached = app.store.state()
                    cached to (cached.journal == null && app.api.hasSession())
                }
                bootstrapping.value = awaitingJournal
                state.value = journalState
            }
        }
        scheduleJournalSync(this)
        setContent {
            val dark = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
            val colors = if (dark) darkColorScheme(primary = Color(0xFFA7D4B1)) else lightColorScheme(
                primary = Color(0xFF3A6B4A), background = Color(0xFFF6F4EF),
            )
            MaterialTheme(colorScheme = colors) {
                Surface(Modifier.fillMaxSize()) {
                    val current by state.collectAsState()
                    val sync by app.syncState.collectAsState()
                    val awaitingJournal by bootstrapping.collectAsState()
                    val journal = current?.journal
                    when {
                        current == null -> Shell { Text("Открываем дневник…") }
                        journal == null && awaitingJournal && sync != SyncState.SignIn -> Shell {
                            Text("Загружаем дневник. Для первой загрузки нужна сеть.")
                            TextButton(onClick = { scheduleJournalSync(this@MainActivity) }) { Text("Повторить загрузку") }
                        }
                        journal == null || signingInAgain -> SignIn(journal?.email)
                        else -> JournalScreen(requireNotNull(current), journal, sync)
                    }
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("codeSentTo", codeSentTo)
        outState.putBoolean("signingInAgain", signingInAgain)
    }

    @Composable
    private fun SignIn(savedEmail: String?) {
        var email by remember(savedEmail) { mutableStateOf(savedEmail.orEmpty()) }
        var code by remember(codeSentTo) { mutableStateOf("") }
        val recipient = codeSentTo
        Shell {
            Text("Дневник тренировок", style = MaterialTheme.typography.headlineLarge)
            if (recipient == null) {
                OutlinedTextField(
                    email, { email = it }, label = { Text("Email") }, enabled = !busy, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
                )
                Button(enabled = !busy && email.contains("@"), onClick = {
                    val address = email.trim().lowercase(Locale.ROOT)
                    action("Не удалось отправить код. Проверьте email и соединение.") {
                        app.sessionLock.withLock { io { app.api.requestCode(address) } }
                        codeSentTo = address
                    }
                }) { Text(if (busy) "Отправляем…" else "Получить код") }
            } else {
                Text("Код отправлен на $recipient")
                OutlinedTextField(
                    code, { code = it.filter { character -> character in '0'..'9' }.take(6) },
                    label = { Text("Код из письма") }, enabled = !busy, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth(),
                )
                Button(enabled = !busy && code.length == 6, onClick = {
                    action("Не удалось войти. Проверьте код и соединение.") {
                        app.sessionLock.withLock { io {
                            app.api.verifyCode(recipient, code)
                            app.store.deactivate()
                        } }
                        codeSentTo = null
                        signingInAgain = false
                        app.syncState.value = SyncState.Idle
                        scheduleJournalSync(this@MainActivity)
                    }
                }) { Text(if (busy) "Входим…" else "Войти") }
                TextButton(enabled = !busy, onClick = { codeSentTo = null; error = "" }) { Text("Изменить email") }
            }
            if (savedEmail != null) {
                TextButton(enabled = !busy, onClick = { signingInAgain = false; codeSentTo = null; error = "" }) {
                    Text("Вернуться к записям")
                }
            }
            ErrorMessage()
        }
    }

    @Composable
    private fun JournalScreen(state: JournalState, journal: Journal, sync: SyncState) {
        val workout = journal.workout
        val pending = state.queue.count { it.entry.state == UploadState.Pending }
        val failed = state.queue.filter { it.entry.state == UploadState.Failed }
        LazyColumn(
            Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().padding(horizontal = 20.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Text("Дневник тренировок", style = MaterialTheme.typography.headlineLarge)
                Text(journal.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row {
                    TextButton(enabled = !busy && sync != SyncState.Syncing, onClick = {
                        scheduleJournalSync(this@MainActivity)
                    }) { Text("Обновить") }
                    TextButton(enabled = !busy, onClick = {
                        action("Не удалось выйти из аккаунта.") {
                            app.sessionLock.withLock { io {
                                app.api.signOut()
                                app.store.deactivate()
                            } }
                        }
                    }) { Text("Выйти") }
                }
                when {
                    sync == SyncState.SignIn -> TextButton(onClick = { signingInAgain = true }) { Text("Войти для синхронизации") }
                    sync == SyncState.Syncing -> Text("Синхронизация…")
                    pending > 0 -> Text("На телефоне сохранено подходов: $pending. Они отправятся при подключении к сети и входе в этот аккаунт.")
                    sync == SyncState.WaitingForNetwork -> Text("Связь с сервером недоступна")
                }
                if (failed.isNotEmpty()) {
                    Text("Сервер не принял эти подходы. Записи сохранены на телефоне.", color = MaterialTheme.colorScheme.error)
                    failed.forEach { Text("${it.exerciseName} · ${formatWeight(it.entry.weight)} кг × ${it.entry.reps}") }
                }
                ErrorMessage()
            }
            if (workout == null) {
                item {
                    Text("Нет активной тренировки", style = MaterialTheme.typography.titleLarge)
                    Text("Начните тренировку на сайте и нажмите «Обновить». После загрузки упражнения доступны без интернета.")
                    TextButton(onClick = { openSite("/dashboard") }) { Text("Открыть Fitness AI") }
                }
            } else {
                item { Text(workout.name, style = MaterialTheme.typography.headlineSmall) }
                items(workout.exercises, key = { it.id }) { exercise ->
                    key(workout.id, exercise.id) { ExerciseCard(state, journal, workout, exercise) }
                }
                item {
                    TextButton(enabled = pending == 0, onClick = { openSite("/workouts/${workout.id}") }) {
                        Text("Открыть тренировку на сайте")
                    }
                }
            }
            if (journal.recent.isNotEmpty()) {
                item { Text("История", style = MaterialTheme.typography.headlineSmall) }
                items(journal.recent, key = { it.id }) { recent ->
                    Column(Modifier.fillMaxWidth()) {
                        Text(recent.name, style = MaterialTheme.typography.titleMedium)
                        Text("${formatDate(recent.startedAt)} · Подходов: ${recent.setCount}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    @Composable
    private fun ExerciseCard(state: JournalState, journal: Journal, workout: Workout, exercise: Exercise) {
        var weight by remember { mutableStateOf("") }
        var reps by remember { mutableStateOf("") }
        val enteredWeight = weight.replace(',', '.').toDoubleOrNull()?.takeIf { it in 0.0..1000.0 }
        val enteredReps = reps.toIntOrNull()?.takeIf { it in 1..100 }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(exercise.name, style = MaterialTheme.typography.titleLarge)
                entryRows(state.entries(workout, exercise))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SetField(weight, { weight = it }, "Вес, кг", KeyboardType.Decimal)
                    SetField(reps, { reps = it }, "Повторы", KeyboardType.Number)
                }
                Button(enabled = !busy && enteredWeight != null && enteredReps != null, onClick = {
                    if (enteredWeight == null || enteredReps == null) return@Button
                    action("Не удалось сохранить подход. Обновите тренировку и попробуйте снова.") {
                        io { app.store.record(journal.accountId, workout.id, exercise.id, enteredWeight, enteredReps) }
                        scheduleJournalSync(this@MainActivity)
                    }
                }) { Text("Записать подход") }
            }
        }
    }

    @Composable
    private fun entryRows(entries: List<SetEntry>) {
        for ((index, entry) in entries.withIndex()) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${index + 1}. ${formatWeight(entry.weight)} кг × ${entry.reps}")
                val label = when (entry.state) {
                    UploadState.Pending -> "На телефоне"
                    UploadState.Sent -> ""
                    UploadState.Failed -> "Не отправлен"
                }
                Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (entries.isNotEmpty()) HorizontalDivider()
    }

    @Composable
    private fun RowScope.SetField(value: String, change: (String) -> Unit, label: String, type: KeyboardType) {
        OutlinedTextField(
            value, { change(it.take(8)) }, label = { Text(label) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = type), modifier = Modifier.weight(1f),
        )
    }

    @Composable
    private fun ErrorMessage() {
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
    }

    private fun action(failure: String, run: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = ""
        lifecycleScope.launch {
            try {
                run()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                error = failure
            } finally {
                busy = false
            }
        }
    }

    private fun openSite(path: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$SITE$path")))
    }
}

@Composable
private fun Shell(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) { content() }
}

private suspend fun <T> io(run: () -> T): T = withContext(Dispatchers.IO) { run() }

private fun formatWeight(weight: Double): String = NumberFormat.getNumberInstance(Locale.forLanguageTag("ru"))
    .apply { maximumFractionDigits = 3 }.format(weight)

private fun formatDate(date: String): String = Instant.parse(date).atZone(ZoneId.systemDefault())
    .format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.forLanguageTag("ru")))
