package app.leadgenerator.fitness.nativeapp

import android.app.Application
import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONException
import java.io.IOException
import java.util.concurrent.TimeUnit

class JournalApplication : Application() {
    internal val store by lazy { JournalStore(this) }
    internal val api by lazy { JournalApi(this) }
    internal val sessionLock = Mutex()
    internal val syncState = MutableStateFlow(SyncState.Idle)
}

internal enum class SyncState { Idle, Syncing, WaitingForNetwork, SignIn }

internal fun scheduleJournalSync(context: Context) {
    val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    val manager = WorkManager.getInstance(context)
    manager.enqueueUniqueWork(
        "journal-sync", ExistingWorkPolicy.APPEND_OR_REPLACE,
        OneTimeWorkRequestBuilder<JournalSyncWorker>().setConstraints(constraints).build(),
    )
    // Recovers an entry if Android terminates the process between the database write and enqueue.
    manager.enqueueUniquePeriodicWork(
        "journal-sync-recovery", ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<JournalSyncWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build(),
    )
}

class JournalSyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    private val app get() = applicationContext as JournalApplication

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        app.sessionLock.withLock {
            val accountId = app.store.accountId() ?: return@withLock Result.success()
            app.syncState.value = SyncState.Syncing
            try {
                sendQueuedSets(app.store.state().queue, app.api::upload, app.store::mark)
                val snapshot = app.api.snapshot()
                if (snapshot.getString("accountId") != accountId) throw HttpFailure(409)
                app.store.saveSnapshot(snapshot)
                app.syncState.value = SyncState.Idle
                Result.success()
            } catch (error: HttpFailure) {
                if (error.code == 401 || error.code == 409) {
                    app.syncState.value = SyncState.SignIn
                    Result.success()
                } else {
                    app.syncState.value = SyncState.WaitingForNetwork
                    Result.retry()
                }
            } catch (_: IOException) {
                app.syncState.value = SyncState.WaitingForNetwork
                Result.retry()
            } catch (_: JSONException) {
                app.syncState.value = SyncState.WaitingForNetwork
                Result.retry()
            }
        }
    }
}

internal fun sendQueuedSets(
    queue: List<QueuedSet>,
    upload: (QueuedSet) -> Unit,
    mark: (String, UploadState) -> Unit,
) {
    for (item in queue.filter { it.entry.state == UploadState.Pending }) {
        val result = try {
            upload(item)
            UploadState.Sent
        } catch (error: HttpFailure) {
            if (error.code != 400 && error.code != 404) throw error
            UploadState.Failed
        }
        mark(item.entry.id, result)
    }
}
