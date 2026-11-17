package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

@Composable
internal fun ProgressEditor(
    kind: ProgressEntryKind,
    initialDate: LocalDate,
    existing: ProgressEntry?,
    save: suspend (LocalDate, JSONObject, String?) -> ProgressEntry,
    onSaved: (ProgressEntry) -> Unit,
    onSessionError: (HttpFailure) -> Unit,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var date by rememberSaveable { mutableStateOf(initialDate.toString()) }
    var rawValues by rememberSaveable {
        mutableStateOf(ArrayList(kind.fields.map { existing?.get(it)?.inputText().orEmpty() }))
    }
    var notes by rememberSaveable { mutableStateOf(existing?.notes.orEmpty()) }
    var pendingId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingValues by rememberSaveable { mutableStateOf<String?>(null) }
    var choosingDate by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun changeField(index: Int, value: String) {
        rawValues = ArrayList(rawValues).apply { this[index] = value }
        error = null
    }

    fun submit() {
        val values = JSONObject()
        for ((index, field) in kind.fields.withIndex()) {
            val raw = rawValues[index].trim().replace(',', '.')
            if (raw.isEmpty()) continue
            val value = raw.toDoubleOrNull()
            if (value == null || value !in field.minimum..field.maximum) {
                error = "Проверьте поле «${field.label}» (${formatNumber(field.minimum)}–${formatNumber(field.maximum)})"
                return
            }
            values.put(field.key, value)
        }
        error = when {
            kind == ProgressEntryKind.MEASUREMENT && values.length() == 0 -> "Заполните хотя бы один замер."
            kind == ProgressEntryKind.SLEEP && !values.has(ProgressField.HOURS.key) -> "Укажите продолжительность сна."
            else -> null
        }
        if (error != null) return
        if (notes.isNotBlank()) values.put("notes", notes)

        if (kind == ProgressEntryKind.MEASUREMENT) {
            val attempt = "$date/$values"
            if (attempt != pendingValues) {
                pendingId = UUID.randomUUID().toString()
                pendingValues = attempt
            }
        }
        saving = true
        scope.launch {
            try {
                onSaved(save(LocalDate.parse(date), values, pendingId))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: HttpFailure) {
                error = when (failure.code) {
                    401, 409 -> {
                        onSessionError(failure)
                        null
                    }
                    400 -> "Проверьте значения и попробуйте ещё раз."
                    else -> "Не удалось сохранить. Попробуйте ещё раз."
                }
            } catch (_: Exception) {
                error = "Не удалось сохранить. Проверьте подключение и попробуйте ещё раз."
            } finally {
                saving = false
            }
        }
    }

    Dialog(
        onDismissRequest = { if (!saving) onDismiss() },
        properties = DialogProperties(dismissOnBackPress = !saving, dismissOnClickOutside = !saving, usePlatformDefaultWidth = false),
    ) {
        Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
            Surface(
                modifier = Modifier.widthIn(max = 460.dp).fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(kind.title, style = MaterialTheme.typography.headlineSmall)
                    Column(
                        Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        val displayDate = LocalDate.parse(date).progressDate(includeYear = true)
                        if (kind == ProgressEntryKind.MEASUREMENT) {
                            OutlinedButton(onClick = { choosingDate = true }, enabled = !saving) {
                                Text("Дата · $displayDate")
                            }
                        } else {
                            Text(displayDate, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (kind == ProgressEntryKind.SLEEP) {
                            ProgressNumberField(kind.fields[0], rawValues[0], { changeField(0, it) }, !saving)
                            Text("Качество сна", style = MaterialTheme.typography.labelLarge)
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                for (rating in 1..5) {
                                    val selected = rawValues[1] == rating.toString()
                                    FilterChip(
                                        selected = selected,
                                        onClick = { changeField(1, if (selected) "" else rating.toString()) },
                                        label = { Text(rating.toString()) },
                                        modifier = Modifier.weight(1f),
                                        enabled = !saving,
                                    )
                                }
                            }
                        } else {
                            for (index in kind.fields.indices step 2) {
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    ProgressNumberField(
                                        kind.fields[index], rawValues[index], { changeField(index, it) }, !saving,
                                        modifier = Modifier.weight(1f),
                                    )
                                    ProgressNumberField(
                                        kind.fields[index + 1], rawValues[index + 1], { changeField(index + 1, it) }, !saving,
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { if (it.length <= 500) notes = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Заметка") },
                            maxLines = 3,
                            enabled = !saving,
                        )
                    }
                    error?.let { message ->
                        Text(message, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
                        TextButton(onClick = onDismiss, enabled = !saving) { Text("Отмена") }
                        Button(onClick = ::submit, enabled = !saving) { Text(if (saving) "Сохраняем…" else "Сохранить") }
                    }
                }
            }
        }
    }

    if (choosingDate) {
        ProgressDatePicker(
            date = LocalDate.parse(date),
            onClose = { choosingDate = false },
            onSelect = { date = it.toString(); choosingDate = false },
        )
    }
}

@Composable
private fun ProgressNumberField(
    field: ProgressField,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier.fillMaxWidth(),
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text("${field.label}, ${field.unit}", maxLines = 1) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        enabled = enabled,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProgressDatePicker(date: LocalDate, onClose: () -> Unit, onSelect: (LocalDate) -> Unit) {
    val picker = rememberDatePickerState(initialSelectedDateMillis = date.toEpochDay() * 86_400_000L)
    DatePickerDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(
                onClick = {
                    picker.selectedDateMillis?.let { onSelect(Instant.ofEpochMilli(it).atOffset(ZoneOffset.UTC).toLocalDate()) }
                },
                enabled = picker.selectedDateMillis != null,
            ) { Text("Выбрать") }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("Отмена") } },
    ) {
        DatePicker(state = picker, showModeToggle = false)
    }
}

private fun Double.inputText(): String = toString().removeSuffix(".0")
