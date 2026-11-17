package app.leadgenerator.fitness.nativeapp

import org.json.JSONObject
import java.time.Instant

internal data class SetEntry(
    val id: String,
    val index: Int,
    val weight: Double,
    val reps: Int,
    val state: UploadState = UploadState.Sent,
)

internal data class Exercise(val id: String, val name: String, val sets: List<SetEntry>, val restSeconds: Int = 120)
internal data class Workout(
    val id: String,
    val name: String,
    val exercises: List<Exercise>,
    val startedAt: String = "",
    val status: String = "active",
) {
    companion object {
        fun fromJson(workout: JSONObject) = Workout(
            id = workout.getString("id"),
            name = workout.getString("name"),
            startedAt = workout.optString("startedAt"),
            status = workout.optString("status", "active"),
            exercises = workout.objects("exercises").map { exercise ->
                Exercise(
                    id = exercise.getString("id"),
                    name = exercise.getString("name"),
                    sets = exercise.objects("sets").map { set ->
                        SetEntry(
                            id = if (set.isNull("clientSetId")) set.getString("id") else set.getString("clientSetId"),
                            index = set.getInt("setIndex"),
                            weight = set.getDouble("weightKg"),
                            reps = set.getInt("reps"),
                        )
                    },
                    restSeconds = exercise.optInt("targetRestSeconds", 120),
                )
            },
        )
    }
}
internal data class RecentWorkout(val id: String, val name: String, val startedAt: String, val setCount: Int)
internal data class TrainingTemplate(val id: String, val name: String, val exerciseCount: Int)

internal data class Journal(
    val accountId: String,
    val email: String,
    val workout: Workout?,
    val recent: List<RecentWorkout>,
    val templates: List<TrainingTemplate> = emptyList(),
    val isAdmin: Boolean = false,
    val displayName: String = "",
    val weightUnit: String = "kg",
) {
    companion object {
        fun fromJson(json: JSONObject) = Journal(
            accountId = json.getString("accountId"),
            email = json.getString("email"),
            workout = json.optJSONObject("workout")?.let(Workout::fromJson),
            templates = json.objects("templates").map {
                TrainingTemplate(it.getString("id"), it.getString("name"), it.getInt("exerciseCount"))
            },
            recent = json.objects("recent").map {
                RecentWorkout(it.getString("id"), it.getString("name"), it.getString("startedAt"), it.getInt("setCount"))
            },
            isAdmin = json.optBoolean("isAdmin"),
            displayName = if (json.isNull("displayName")) "" else json.optString("displayName"),
            weightUnit = json.optString("weightUnit", "kg"),
        )
    }
}

internal enum class UploadState { Pending, Sent, Failed }

internal data class QueuedSet(
    val accountId: String,
    val workoutId: String,
    val exerciseId: String,
    val exerciseName: String,
    val entry: SetEntry,
    val completedAt: String = Instant.now().toString(),
) {
    fun payload() = JSONObject()
        .put("accountId", accountId)
        .put("workoutId", workoutId)
        .put("workoutExerciseId", exerciseId)
        .put("clientSetId", entry.id)
        .put("weightKg", entry.weight)
        .put("reps", entry.reps)
        .put("completedAt", completedAt)
}

internal data class JournalState(val journal: Journal? = null, val queue: List<QueuedSet> = emptyList()) {
    fun entries(workout: Workout, exercise: Exercise): List<SetEntry> {
        val local = queue.filter { it.workoutId == workout.id && it.exerciseId == exercise.id }.map { it.entry }
        return (exercise.sets + local).distinctBy { it.id }.sortedBy { it.index }
    }
}

internal fun JSONObject.objects(key: String): List<JSONObject> {
    val array = optJSONArray(key) ?: return emptyList()
    return List(array.length()) { array.getJSONObject(it) }
}
