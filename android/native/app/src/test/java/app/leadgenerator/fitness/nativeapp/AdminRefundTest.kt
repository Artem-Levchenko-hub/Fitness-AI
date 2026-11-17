package app.leadgenerator.fitness.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AdminRefundTest {
    @Test
    fun onlyEligiblePaymentsAcceptATrimmedAuditReason() {
        assertEquals("Ошибка платежа", validAdminRefundReason("  Ошибка платежа  ", true))
        assertEquals("x".repeat(500), validAdminRefundReason("x".repeat(500), true))
        assertNull(validAdminRefundReason(" ok ", true))
        assertNull(validAdminRefundReason("x".repeat(501), true))
        assertNull(validAdminRefundReason("Ошибка платежа", false))
    }

    @Test
    fun providerOutcomesDistinguishConfirmedPendingAndCanceledRefunds() {
        assertEquals(AdminRefundResult.Refunded, AdminRefundResult.fromStatus("refunded"))
        assertEquals(AdminRefundResult.Pending, AdminRefundResult.fromStatus("refund_pending"))
        assertEquals(AdminRefundResult.Canceled, AdminRefundResult.fromStatus("succeeded"))
        assertEquals(AdminRefundResult.Unknown, AdminRefundResult.fromStatus(""))
    }
}
