package app.leadgenerator.fitness.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class SyncQueueTest {
    @Test
    fun uncertainDeliveryRetainsTheSameEntryForRetry() {
        val set = queued("set-1")
        val attempts = mutableListOf<String>()
        val acknowledgements = mutableListOf<UploadState>()

        assertThrows(IOException::class.java) {
            sendQueuedSets(listOf(set), { entry ->
                attempts += entry.entry.id
                throw IOException("Connection closed before the acknowledgement")
            }, { _, state -> acknowledgements += state })
        }
        assertEquals(emptyList<UploadState>(), acknowledgements)

        sendQueuedSets(listOf(set), { attempts += it.entry.id }, { _, state -> acknowledgements += state })
        assertEquals(listOf("set-1", "set-1"), attempts)
        assertEquals(listOf(UploadState.Sent), acknowledgements)
    }

    @Test
    fun missingExercisePreservesTheFailedEntryAndSendsTheNextSet() {
        val states = mutableListOf<Pair<String, UploadState>>()
        sendQueuedSets(listOf(queued("deleted"), queued("next")), {
            if (it.entry.id == "deleted") throw HttpFailure(404)
        }, { id, state -> states += id to state })
        assertEquals(listOf("deleted" to UploadState.Failed, "next" to UploadState.Sent), states)
    }

    private fun queued(id: String) = QueuedSet("account", "workout", "exercise", "Приседания",
        SetEntry(id, 0, 80.0, 8, UploadState.Pending))
}
