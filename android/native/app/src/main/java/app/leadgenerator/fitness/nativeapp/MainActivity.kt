package app.leadgenerator.fitness.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID

class MainActivity : ComponentActivity() {
    private val app get() = application as JournalApplication
    private val state = MutableStateFlow<JournalState?>(null)
    private val bootstrapping = MutableStateFlow(false)
    private var busy by mutableStateOf(false)
    private var error by mutableStateOf("")
    private var codeSentTo by mutableStateOf<String?>(null)
    private var signingInAgain by mutableStateOf(false)
    private var resumeCount by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        codeSentTo = savedInstanceState?.getString("codeSentTo")
        signingInAgain = savedInstanceState?.getBoolean("signingInAgain") == true
        enableEdgeToEdge()
        lifecycleScope.launch {
            app.store.changes.collect {
                val (cached, awaitingJournal) = io {
                    val stored = app.store.state()
                    stored to (stored.journal == null && app.api.hasSession())
                }
                bootstrapping.value = awaitingJournal
                state.value = cached
            }
        }
        refreshJournal()
        setContent {
            VibeTheme {
                val cached by state.collectAsState()
                val sync by app.syncState.collectAsState()
                val awaitingJournal by bootstrapping.collectAsState()
                val journal = cached?.journal
                if (journal != null && !signingInAgain) {
                    key(journal.accountId) { SignedInApp(requireNotNull(cached), journal, sync) }
                } else {
                    Scaffold(containerColor = MaterialTheme.colorScheme.background, contentWindowInsets = WindowInsets.safeDrawing) { padding ->
                        Box(Modifier.fillMaxSize().padding(padding).imePadding()) {
                            when {
                                cached == null -> VibeList { item { VibeHeading("Vibe-trainer", "Открываем дневник…") } }
                                journal == null && awaitingJournal && sync != SyncState.SignIn -> VibeList {
                                    item {
                                        VibeHeading("Vibe-trainer", "Загружаем дневник. Для первой загрузки нужна сеть.")
                                        TextButton(onClick = ::refreshJournal) { Text("Повторить загрузку") }
                                    }
                                }
                                else -> SignIn(journal?.email)
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        resumeCount++
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("codeSentTo", codeSentTo)
        outState.putBoolean("signingInAgain", signingInAgain)
    }

    @Composable
    private fun SignIn(savedEmail: String?) {
        var email by rememberSaveable(savedEmail) { mutableStateOf(savedEmail.orEmpty()) }
        var code by remember(codeSentTo) { mutableStateOf("") }
        val recipient = codeSentTo
        VibeList {
            item {
                Image(painterResource(R.mipmap.ic_launcher), null, Modifier.size(64.dp))
                VibeHeading("Vibe-trainer", "Войдите по коду из письма, чтобы открыть свой дневник.")
            }
            item {
                VibeCard {
                    if (recipient == null) {
                        OutlinedTextField(email, { email = it.take(254) }, Modifier.fillMaxWidth(),
                            label = { Text("Email") }, enabled = !busy, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
                        Button(enabled = !busy && email.contains("@"), onClick = {
                            val address = email.trim().lowercase()
                            action("Не удалось отправить код. Проверьте email и соединение.") {
                                app.sessionLock.withLock { io { app.api.requestCode(address) } }
                                codeSentTo = address
                            }
                        }) { Text(if (busy) "Отправляем…" else "Получить код") }
                    } else {
                        Text("Код отправлен на $recipient")
                        OutlinedTextField(code, { code = it.filter { character -> character in '0'..'9' }.take(6) },
                            Modifier.fillMaxWidth(), label = { Text("Код из письма") }, enabled = !busy, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                        Button(enabled = !busy && code.length == 6, onClick = {
                            action("Не удалось войти. Проверьте код и соединение.") {
                                app.sessionLock.withLock { io {
                                    app.api.verifyCode(recipient, code)
                                    app.store.deactivate()
                                } }
                                codeSentTo = null
                                signingInAgain = false
                                app.syncState.value = SyncState.Idle
                                refreshJournal()
                            }
                        }) { Text(if (busy) "Входим…" else "Войти") }
                        TextButton(enabled = !busy, onClick = { codeSentTo = null; error = "" }) { Text("Изменить email") }
                    }
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                }
            }
            if (savedEmail != null) item {
                TextButton(enabled = !busy, onClick = { signingInAgain = false; codeSentTo = null; error = "" }) {
                    Text("Вернуться к записям")
                }
            }
        }
    }

    @Composable
    private fun SignedInApp(cached: JournalState, journal: Journal, sync: SyncState) {
        val sections = rememberPagerState(pageCount = { MainTab.entries.size })
        val sectionScope = rememberCoroutineScope()
        val focusManager = LocalFocusManager.current
        val keyboard = LocalSoftwareKeyboardController.current
        var page by rememberSaveable(journal.accountId) { mutableStateOf<DetailPage?>(null) }
        var workoutId by rememberSaveable(journal.accountId) { mutableStateOf("") }
        var coachWorkout by rememberSaveable(journal.accountId, stateSaver = CoachWorkout.Saver) { mutableStateOf<CoachWorkout?>(null) }
        var videoBusy by remember { mutableStateOf(false) }
        var restDeadline by rememberSaveable(journal.workout?.id) { mutableLongStateOf(0L) }
        var startKey by rememberSaveable(journal.accountId) { mutableStateOf("") }
        var startTemplate by rememberSaveable(journal.accountId) { mutableStateOf("") }
        var editingTemplateId by rememberSaveable(journal.accountId) { mutableStateOf<String?>(null) }
        val snackbar = remember { SnackbarHostState() }
        LaunchedEffect(page, error) {
            if (page == DetailPage.Library && error.isNotBlank()) snackbar.showSnackbar(error)
        }
        LaunchedEffect(sections) {
            snapshotFlow { sections.settledPage }.drop(1).collect {
                focusManager.clearFocus()
                keyboard?.hide()
                error = ""
            }
        }
        val selectSection: (MainTab) -> Unit = { destination ->
            focusManager.clearFocus()
            keyboard?.hide()
            error = ""
            sectionScope.launch {
                sections.animateScrollToPage(
                    destination.ordinal,
                    animationSpec = tween(durationMillis = 320, easing = FastOutSlowInEasing),
                )
            }
        }
        val transport: ScreenRequest = { path, payload -> ownedRequest(journal.accountId) { app.api.request(path, payload) } }
        val closePage: () -> Unit = {
            if (!videoBusy) {
                page = if (page == DetailPage.Coach) DetailPage.Workout else null
                error = ""
            }
        }
        val openWorkout: (String) -> Unit = { id -> workoutId = id; page = DetailPage.Workout }
        val signIn = { signingInAgain = true; error = "" }
        val startWorkout: (TrainingTemplate) -> Unit = { template ->
            if (startTemplate != template.id || startKey.isBlank()) {
                startTemplate = template.id
                startKey = UUID.randomUUID().toString()
            }
            val body = JSONObject().put("action", "start").put("templateId", template.id).put("clientWorkoutId", startKey)
            action("Не удалось начать тренировку.") {
                sessionAction(journal.accountId, body)
                startKey = ""
                page = null
                selectSection(MainTab.Training)
            }
        }
        BackHandler(enabled = page != null, onBack = closePage)

        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            contentWindowInsets = WindowInsets.safeDrawing,
            snackbarHost = { SnackbarHost(snackbar) },
            topBar = {
                if (page != null && page != DetailPage.Admin) {
                    Surface(color = MaterialTheme.colorScheme.background) {
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp, start = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = closePage, enabled = !videoBusy) { Icon(Icons.AutoMirrored.Default.ArrowBack, "Назад") }
                            Text("Vibe-trainer", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            },
            bottomBar = {
                if (page == null) NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                    MainTab.entries.forEachIndexed { index, entry ->
                        NavigationBarItem(
                            selected = sections.targetPage == index, onClick = { selectSection(entry) },
                            icon = { Icon(entry.icon, null) }, label = { Text(entry.label) },
                        )
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding).imePadding()) {
                MainSectionsPager(
                    state = sections,
                    userScrollEnabled = page == null,
                    modifier = if (page == null) Modifier else Modifier.clearAndSetSemantics { },
                ) { index ->
                    when (MainTab.entries[index]) {
                        MainTab.Home -> HomeScreen(journal, { selectSection(MainTab.Training) }, { selectSection(MainTab.Progress) },
                            { page = DetailPage.Catalog }, openWorkout, { page = DetailPage.Body })
                        MainTab.Progress -> ProgressScreen(
                            transport,
                            active = page == null && sections.settledPage == index,
                        )
                        MainTab.Profile -> Profile(journal, sync, signIn, ::refreshJournal, { page = it })
                        MainTab.Training -> TrainingScreen(
                            cached, journal, sync, busy, error, restDeadline, { restDeadline = 0 }, ::refreshJournal, signIn,
                            onStart = startWorkout,
                            onFinish = { workout -> action("Не удалось завершить тренировку.") {
                                sessionAction(journal.accountId, JSONObject().put("action", "finish").put("workoutId", workout.id))
                                openWorkout(workout.id)
                            } },
                            onCancel = { workout -> action("Не удалось отменить тренировку.") {
                                sessionAction(journal.accountId, JSONObject().put("action", "cancel").put("workoutId", workout.id))
                            } },
                            onRecord = { workout, exercise, weight, reps -> action("Не удалось сохранить подход.") {
                                io { app.store.record(journal.accountId, workout.id, exercise.id, weight, reps) }
                                if (exercise.restSeconds > 0) restDeadline = SystemClock.elapsedRealtime() + exercise.restSeconds * 1000L
                                refreshJournal()
                            } },
                            onHistory = openWorkout, onCatalog = { page = DetailPage.Catalog }, onNewTemplate = { editingTemplateId = null; page = DetailPage.Template },
                            onFormats = { page = DetailPage.Formats },
                            onLibrary = { page = DetailPage.Library },
                            onEditTemplate = { id -> editingTemplateId = id; page = DetailPage.Template },
                        )
                    }
                }
                if (page != null) Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    when (page) {
                        DetailPage.Admin -> if (journal.isAdmin) AdminScreen(transport, closePage) else VibeList {
                            item {
                                VibeHeading("Админка", "Доступ закрыт.")
                                TextButton(onClick = closePage) { Text("Назад") }
                            }
                        }
                        DetailPage.Catalog, DetailPage.Template -> CatalogScreen(journal.accountId, page == DetailPage.Template, transport, editingTemplateId) {
                            refreshJournal()
                            selectSection(MainTab.Training)
                            closePage()
                        }
                        DetailPage.Wallet -> WalletScreen(transport, resumeCount, ::openExternal)
                        DetailPage.Formats -> FormatsScreen(transport, journal.accountId, journal.weightUnit)
                        DetailPage.Body -> BodyScreen(request = transport)
                        DetailPage.Library -> LibraryScreen(transport, startWorkout, busy,
                            onSubscription = { page = DetailPage.Wallet },
                            onEditTemplate = { id -> editingTemplateId = id; page = DetailPage.Template })
                        DetailPage.Schedule -> CompanionScreen("schedule", transport)
                        DetailPage.Friends -> CompanionScreen("friends", transport)
                        DetailPage.Notes -> CompanionScreen("notes", transport)
                        DetailPage.Settings -> ProfileSettings(journal.accountId, transport) { refreshJournal(); closePage() }
                        DetailPage.Workout, DetailPage.Coach -> {
                            val selected = coachWorkout
                            if (page == DetailPage.Coach && selected != null) CoachScreen(selected, transport,
                                onMessage = { body -> ownedRequest(journal.accountId) { app.api.coach(body) } },
                                onVideo = { workout, exercise, request, bytes ->
                                    ownedRequest(journal.accountId) { app.api.videoTechnique(workout, exercise, request, bytes) }
                                },
                                videoBusy = videoBusy, onVideoBusy = { videoBusy = it },
                            ) else WorkoutDetails(workoutId, journal.weightUnit, transport) { workout -> coachWorkout = workout; page = DetailPage.Coach }
                        }
                        null -> Unit
                    }
                }
            }
        }
    }

    @Composable
    private fun Profile(journal: Journal, sync: SyncState, onSignIn: () -> Unit, onRefresh: () -> Unit, onOpen: (DetailPage) -> Unit) {
        VibeList {
            item { VibeHeading("Профиль") }
            item {
                VibeCard {
                    Text(journal.displayName.ifBlank { journal.email }, style = MaterialTheme.typography.titleLarge)
                    if (journal.displayName.isNotBlank()) Text(journal.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    SyncStatus(sync, state.value?.queue?.count { it.entry.state == UploadState.Pending } ?: 0, onSignIn)
                    TextButton(onClick = onRefresh, enabled = !busy && sync != SyncState.Syncing) { Text("Синхронизировать") }
                }
            }
            item { SettingsRow("Настройки профиля", Icons.Default.Settings) { onOpen(DetailPage.Settings) } }
            item { SettingsRow("Модель тела и мышцы", Icons.Default.Person) { onOpen(DetailPage.Body) } }
            item { SettingsRow("Расписание", Icons.Default.DateRange) { onOpen(DetailPage.Schedule) } }
            item { SettingsRow("Друзья", Icons.Default.Person) { onOpen(DetailPage.Friends) } }
            item { SettingsRow("Заметки", Icons.Default.List) { onOpen(DetailPage.Notes) } }
            item { SettingsRow("Подписка и баланс", Icons.Default.Favorite) { onOpen(DetailPage.Wallet) } }
            if (journal.isAdmin) item { SettingsRow("Админка", Icons.Default.Settings) { onOpen(DetailPage.Admin) } }
            item {
                TextButton(enabled = !busy, onClick = {
                    action("Не удалось выйти из аккаунта.") {
                        app.sessionLock.withLock { io { app.api.signOut(); app.store.deactivate() } }
                    }
                }) { Text("Выйти") }
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            }
        }
    }

    private suspend fun sessionAction(accountId: String, body: JSONObject) {
        ownedRequest(accountId) {
            val workoutId = body.optString("workoutId")
            if (workoutId.isNotBlank() && app.store.state().queue.any { it.workoutId == workoutId && it.entry.state == UploadState.Pending }) {
                throw HttpFailure(409, "pending_sets")
            }
            app.api.request("/api/mobile/v1/journal/session", body.put("accountId", accountId))
            val updated = app.api.snapshot()
            if (updated.optString("accountId") != accountId) throw HttpFailure(409, "account_changed")
            app.store.saveSnapshot(updated)
        }
        refreshJournal()
    }

    private suspend fun <T> ownedRequest(accountId: String, run: () -> T): T = app.sessionLock.withLock {
        io {
            if (app.store.accountId() != accountId) throw HttpFailure(409, "account_changed")
            try {
                run()
            } catch (failure: HttpFailure) {
                if (failure.code == 401 || failure.reason == "account_changed") app.syncState.value = SyncState.SignIn
                throw failure
            }
        }
    }

    private fun refreshJournal() = scheduleJournalSync(this)

    private fun action(failure: String, run: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = ""
        lifecycleScope.launch {
            try {
                run()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (requestFailure: Exception) {
                error = when ((requestFailure as? HttpFailure)?.reason) {
                    "active_workout_exists" -> "Уже есть активная тренировка. Обновите дневник, чтобы продолжить её."
                    "pending_sets" -> "Дождитесь отправки подходов."
                    else -> failure
                }
            } finally {
                busy = false
            }
        }
    }

    private fun openExternal(url: String) {
        val link = Uri.parse(url)
        require(link.scheme == "https" && !link.host.isNullOrBlank())
        startActivity(Intent(Intent.ACTION_VIEW, link))
    }
}

private suspend fun <T> io(run: () -> T): T = withContext(Dispatchers.IO) { run() }

private enum class MainTab(val label: String, val icon: ImageVector) {
    Home("Главная", Icons.Default.Home), Training("Тренировки", Icons.Default.List),
    Progress("Прогресс", Icons.Default.Favorite), Profile("Профиль", Icons.Default.Person),
}

private enum class DetailPage { Workout, Coach, Catalog, Template, Wallet, Admin, Formats, Library, Schedule, Friends, Notes, Settings, Body }
