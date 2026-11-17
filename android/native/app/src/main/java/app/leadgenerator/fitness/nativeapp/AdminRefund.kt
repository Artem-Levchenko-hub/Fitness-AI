package app.leadgenerator.fitness.nativeapp

internal fun validAdminRefundReason(value: String, canRequestRefund: Boolean): String? =
    value.trim().takeIf { canRequestRefund && it.length in 3..500 }

internal enum class AdminRefundResult {
    Refunded, Pending, Canceled, Unknown;

    companion object {
        fun fromStatus(status: String): AdminRefundResult = when (status) {
            "refunded" -> Refunded
            "refund_pending" -> Pending
            "succeeded" -> Canceled
            else -> Unknown
        }
    }
}
