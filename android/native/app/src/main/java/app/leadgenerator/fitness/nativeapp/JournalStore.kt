package app.leadgenerator.fitness.nativeapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONObject
import java.util.UUID

internal class JournalStore(context: Context) : SQLiteOpenHelper(context, "journal.db", null, 1) {
    private val preferences = context.getSharedPreferences("journal", Context.MODE_PRIVATE)
    val changes = MutableStateFlow(0L)

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE journals (account_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        db.execSQL("""
            CREATE TABLE queued_sets (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                workout_id TEXT NOT NULL,
                exercise_id TEXT NOT NULL,
                exercise_name TEXT NOT NULL,
                set_index INTEGER NOT NULL,
                weight REAL NOT NULL,
                reps INTEGER NOT NULL,
                completed_at TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """.trimIndent())
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) =
        error("Missing journal migration from version $oldVersion to $newVersion")

    @Synchronized
    fun accountId(): String? = preferences.getString("account", null)

    @Synchronized
    fun state(): JournalState {
        val accountId = accountId() ?: return JournalState()
        return JournalState(cachedJournal(accountId), queue(accountId))
    }

    @Synchronized
    fun saveSnapshot(json: JSONObject, activate: Boolean = false) {
        val journal = Journal.fromJson(json)
        val values = ContentValues().apply {
            put("account_id", journal.accountId)
            put("payload", json.toString())
        }
        val db = writableDatabase
        db.beginTransaction()
        try {
            check(db.insertWithOnConflict("journals", null, values, SQLiteDatabase.CONFLICT_REPLACE) != -1L)
            // A response can be lost after the server wrote a set. A returned ID is also an acknowledgement.
            journal.workout?.exercises?.flatMap { it.sets }?.forEach { set ->
                db.delete("queued_sets", "account_id = ? AND id = ?", arrayOf(journal.accountId, set.id))
            }
            // Sent entries on older workouts are already in the server's history.
            val otherWorkouts = journal.workout?.id?.let { " AND workout_id != ?" }.orEmpty()
            val arguments = listOfNotNull(journal.accountId, UploadState.Sent.name, journal.workout?.id).toTypedArray()
            db.delete("queued_sets", "account_id = ? AND status = ?$otherWorkouts", arguments)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        if (activate) check(preferences.edit().putString("account", journal.accountId).commit())
        changes.update { it + 1 }
    }

    @Synchronized
    fun record(accountId: String, workoutId: String, exerciseId: String, weight: Double, reps: Int) {
        require(weight.isFinite() && weight in 0.0..1000.0 && reps in 1..100)
        val snapshot = state()
        val journal = requireNotNull(snapshot.journal)
        require(journal.accountId == accountId)
        val workout = requireNotNull(journal.workout).also { require(it.id == workoutId) }
        val exercise = workout.exercises.first { it.id == exerciseId }
        val index = (snapshot.entries(workout, exercise).maxOfOrNull { it.index } ?: -1) + 1
        require(index <= 1000)
        val entry = QueuedSet(accountId, workoutId, exercise.id, exercise.name, SetEntry(
            UUID.randomUUID().toString(), index, weight, reps, UploadState.Pending,
        ))
        val values = ContentValues().apply {
            put("id", entry.entry.id)
            put("account_id", accountId)
            put("workout_id", workoutId)
            put("exercise_id", exerciseId)
            put("exercise_name", exercise.name)
            put("set_index", index)
            put("weight", weight)
            put("reps", reps)
            put("completed_at", entry.completedAt)
            put("status", UploadState.Pending.name)
        }
        writableDatabase.insertOrThrow("queued_sets", null, values)
        changes.update { it + 1 }
    }

    @Synchronized
    fun mark(id: String, status: UploadState) {
        val values = ContentValues().apply { put("status", status.name) }
        writableDatabase.update("queued_sets", values, "id = ?", arrayOf(id))
        changes.update { it + 1 }
    }

    @Synchronized
    fun deactivate() {
        check(preferences.edit().remove("account").commit())
        changes.update { it + 1 }
    }

    private fun cachedJournal(accountId: String): Journal? = readableDatabase.rawQuery(
        "SELECT payload FROM journals WHERE account_id = ?", arrayOf(accountId),
    ).use { cursor -> if (cursor.moveToFirst()) Journal.fromJson(JSONObject(cursor.getString(0))) else null }

    private fun queue(accountId: String): List<QueuedSet> = readableDatabase.rawQuery(
        """
            SELECT id, workout_id, exercise_id, exercise_name, set_index, weight, reps, completed_at, status
            FROM queued_sets WHERE account_id = ? ORDER BY rowid
        """.trimIndent(), arrayOf(accountId),
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(QueuedSet(accountId, cursor.getString(1), cursor.getString(2), cursor.getString(3),
                    SetEntry(cursor.getString(0), cursor.getInt(4), cursor.getDouble(5), cursor.getInt(6),
                        UploadState.valueOf(cursor.getString(8))), cursor.getString(7)))
            }
        }
    }
}
