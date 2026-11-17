package app.leadgenerator.fitness.nativeapp

import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter

internal const val PROGRESS_PATH = "/api/mobile/v1/progress"

internal enum class ProgressField(
    val key: String,
    val label: String,
    val unit: String,
    val minimum: Double,
    val maximum: Double,
) {
    WEIGHT("weightKg", "Вес", "кг", 20.0, 500.0),
    BODY_FAT("bodyFatPct", "Доля жира", "%", 1.0, 70.0),
    WAIST("waistCm", "Талия", "см", 30.0, 300.0),
    NECK("neckCm", "Шея", "см", 20.0, 100.0),
    CHEST("chestCm", "Грудь", "см", 50.0, 200.0),
    HIPS("hipCm", "Бёдра", "см", 30.0, 250.0),
    ARM("armCm", "Бицепс", "см", 15.0, 80.0),
    THIGH("thighCm", "Бедро", "см", 20.0, 120.0),
    HOURS("hours", "Часы сна", "ч", 0.0, 24.0),
    QUALITY("quality", "Качество сна", "", 1.0, 5.0),
    CALORIES("kcal", "Калории", "ккал", 0.0, 10_000.0),
    PROTEIN("proteinG", "Белки", "г", 0.0, 1_000.0),
    FAT("fatG", "Жиры", "г", 0.0, 1_000.0),
    CARBS("carbsG", "Углеводы", "г", 0.0, 2_000.0),
}

internal enum class ProgressEntryKind(val code: String, val title: String, val fields: List<ProgressField>) {
    MEASUREMENT("measurement", "Новый замер", listOf(
        ProgressField.WEIGHT, ProgressField.BODY_FAT, ProgressField.WAIST, ProgressField.NECK,
        ProgressField.CHEST, ProgressField.HIPS, ProgressField.ARM, ProgressField.THIGH,
    )),
    SLEEP("sleep", "Запись о сне", listOf(ProgressField.HOURS, ProgressField.QUALITY)),
    NUTRITION("nutrition", "Запись о питании", listOf(
        ProgressField.CALORIES, ProgressField.PROTEIN, ProgressField.FAT, ProgressField.CARBS,
    )),
}

internal data class ProgressEntry(
    val id: String?,
    val date: LocalDate,
    val fields: Map<ProgressField, Double>,
    val notes: String?,
) {
    operator fun get(field: ProgressField): Double? = fields[field]

    companion object {
        fun read(json: JSONObject, kind: ProgressEntryKind): ProgressEntry = ProgressEntry(
            id = json.optString("id").takeIf(String::isNotBlank),
            date = LocalDate.parse(json.getString("date")),
            fields = kind.fields.mapNotNull { field ->
                json.optDouble(field.key).takeIf(Double::isFinite)?.let { field to it }
            }.toMap(),
            notes = json.optString("notes").takeIf { !json.isNull("notes") && it.isNotBlank() },
        )
    }
}

internal data class ProgressDay(
    val date: LocalDate,
    val volumeKg: Double,
    val sets: Int,
    val reps: Int,
    val count: Int,
)

internal data class ProgressSnapshot(
    val accountId: String,
    val today: LocalDate,
    val training: List<ProgressDay>,
    val measurements: List<ProgressEntry>,
    val sleepToday: ProgressEntry?,
    val nutritionToday: ProgressEntry?,
    val sleep: List<ProgressEntry>,
    val nutrition: List<ProgressEntry>,
) {
    fun withEntry(kind: ProgressEntryKind, entry: ProgressEntry): ProgressSnapshot = when (kind) {
        ProgressEntryKind.MEASUREMENT -> copy(
            measurements = (listOf(entry) + measurements.filterNot { it.id == entry.id })
                .sortedByDescending { it.date }.take(30),
        )
        ProgressEntryKind.SLEEP -> copy(
            sleepToday = if (entry.date == today) entry else sleepToday,
            sleep = historyWith(sleep, entry),
        )
        ProgressEntryKind.NUTRITION -> copy(
            nutritionToday = if (entry.date == today) entry else nutritionToday,
            nutrition = historyWith(nutrition, entry),
        )
    }

    fun entryFor(kind: ProgressEntryKind, date: LocalDate): ProgressEntry? = when (kind) {
        ProgressEntryKind.MEASUREMENT -> null
        ProgressEntryKind.SLEEP -> if (date == today) sleepToday else sleep.firstOrNull { it.date == date }
        ProgressEntryKind.NUTRITION ->
            if (date == today) nutritionToday else nutrition.firstOrNull { it.date == date }
    }

    companion object {
        fun read(json: JSONObject): ProgressSnapshot = ProgressSnapshot(
            accountId = json.getString("accountId"),
            today = LocalDate.parse(json.getString("today")),
            training = json.objects("training").map { day ->
                ProgressDay(
                    LocalDate.parse(day.getString("date")),
                    day.getDouble("volumeKg"),
                    day.getInt("sets"),
                    day.getInt("reps"),
                    day.getInt("count"),
                )
            },
            measurements = json.objects("measurements").map { ProgressEntry.read(it, ProgressEntryKind.MEASUREMENT) },
            sleepToday = json.optJSONObject("sleepToday")?.let { ProgressEntry.read(it, ProgressEntryKind.SLEEP) },
            nutritionToday = json.optJSONObject("nutritionToday")?.let { ProgressEntry.read(it, ProgressEntryKind.NUTRITION) },
            sleep = json.objects("sleep").map { ProgressEntry.read(it, ProgressEntryKind.SLEEP) },
            nutrition = json.objects("nutrition").map { ProgressEntry.read(it, ProgressEntryKind.NUTRITION) },
        )
    }
}

private fun historyWith(history: List<ProgressEntry>, entry: ProgressEntry): List<ProgressEntry> =
    (listOf(entry) + history.filterNot { it.date == entry.date }).sortedByDescending { it.date }.take(14)

private val ShortProgressDate = DateTimeFormatter.ofPattern("d MMM", RussianLocale)
private val FullProgressDate = DateTimeFormatter.ofPattern("d MMM yyyy", RussianLocale)

internal fun LocalDate.progressDate(includeYear: Boolean = false): String =
    format(if (includeYear) FullProgressDate else ShortProgressDate)
