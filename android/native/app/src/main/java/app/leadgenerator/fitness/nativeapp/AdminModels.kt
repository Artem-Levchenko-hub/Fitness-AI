package app.leadgenerator.fitness.nativeapp

import org.json.JSONObject

internal data class AdminSummary(
    val userCount: Int,
    val active7d: Int,
    val totalPurchasedKopecks: Long,
    val totalSpentKopecks: Long,
)

internal data class AdminBilling(
    val mode: String,
    val paymentsEnabled: Boolean,
    val subscriptionsEnabled: Boolean,
    val recurringPaymentsEnabled: Boolean,
    val paymentMissing: List<String>,
    val subscriptionMissing: List<String>,
)

internal data class AdminUser(
    val id: String,
    val name: String?,
    val email: String,
    val createdAt: String,
    val lastActivityAt: String?,
    val strengthCount: Int,
    val circuitCount: Int,
    val cardioCount: Int,
    val balanceKopecks: Long,
    val totalPurchasedKopecks: Long,
    val totalSpentKopecks: Long,
    val tier: String?,
) {
    val displayName: String get() = name?.trim()?.takeIf(String::isNotEmpty) ?: email
    val workoutCount: Int get() = strengthCount + circuitCount + cardioCount
}

internal data class AdminPayment(
    val id: String,
    val userEmail: String,
    val kind: String,
    val amountKopecks: Long,
    val status: String,
    val createdAt: String,
    val refundedAt: String?,
    val canRequestRefund: Boolean,
)

internal data class AdminOverview(
    val summary: AdminSummary,
    val billing: AdminBilling,
    val users: List<AdminUser>,
    val payments: List<AdminPayment>,
) {
    companion object {
        fun fromJson(json: JSONObject): AdminOverview {
            val summary = json.getJSONObject("summary")
            val billing = json.getJSONObject("billing")
            return AdminOverview(
                summary = AdminSummary(
                    userCount = summary.getInt("userCount"),
                    active7d = summary.getInt("active7d"),
                    totalPurchasedKopecks = summary.getLong("totalPurchasedKopecks"),
                    totalSpentKopecks = summary.getLong("totalSpentKopecks"),
                ),
                billing = AdminBilling(
                    mode = billing.getString("mode"),
                    paymentsEnabled = billing.getBoolean("paymentsEnabled"),
                    subscriptionsEnabled = billing.getBoolean("subscriptionsEnabled"),
                    recurringPaymentsEnabled = billing.getBoolean("recurringPaymentsEnabled"),
                    paymentMissing = billing.strings("paymentMissing"),
                    subscriptionMissing = billing.strings("subscriptionMissing"),
                ),
                users = json.objects("users").map { user ->
                    AdminUser(
                        id = user.getString("id"), name = user.nullableString("name"), email = user.getString("email"),
                        createdAt = user.getString("createdAt"), lastActivityAt = user.nullableString("lastActivityAt"),
                        strengthCount = user.getInt("strengthCount"), circuitCount = user.getInt("circuitCount"),
                        cardioCount = user.getInt("cardioCount"), balanceKopecks = user.getLong("balanceKopecks"),
                        totalPurchasedKopecks = user.getLong("totalPurchasedKopecks"),
                        totalSpentKopecks = user.getLong("totalSpentKopecks"), tier = user.nullableString("tier"),
                    )
                },
                payments = json.objects("payments").map { payment ->
                    AdminPayment(
                        id = payment.getString("id"), userEmail = payment.getString("userEmail"),
                        kind = payment.getString("kind"), amountKopecks = payment.getLong("amountKopecks"),
                        status = payment.getString("status"), createdAt = payment.getString("createdAt"),
                        refundedAt = payment.nullableString("refundedAt"),
                        canRequestRefund = payment.optBoolean("canRequestRefund"),
                    )
                },
            )
        }
    }
}

internal data class AdminWorkout(
    val id: String,
    val name: String,
    val startedAt: String,
    val finishedAt: String?,
    val setCount: Int,
    val tonnageKg: Double,
    val score: Int?,
)

internal data class AdminTemplate(val id: String, val format: String, val name: String, val meta: String)

internal data class AdminUserDetail(
    val id: String,
    val name: String?,
    val email: String,
    val heightCm: Int?,
    val weightKg: Double?,
    val workouts: List<AdminWorkout>,
    val templates: List<AdminTemplate>,
) {
    val displayName: String get() = name?.trim()?.takeIf(String::isNotEmpty) ?: email

    companion object {
        fun fromJson(json: JSONObject): AdminUserDetail {
            val profile = json.getJSONObject("profile")
            return AdminUserDetail(
                id = profile.getString("id"), name = profile.nullableString("name"), email = profile.getString("email"),
                heightCm = if (profile.isNull("heightCm")) null else profile.getInt("heightCm"),
                weightKg = if (profile.isNull("weightKg")) null else profile.getDouble("weightKg"),
                workouts = json.objects("workouts").map { workout ->
                    AdminWorkout(
                        id = workout.getString("id"), name = workout.getString("name"),
                        startedAt = workout.getString("startedAt"), finishedAt = workout.nullableString("finishedAt"),
                        setCount = workout.getInt("setCount"), tonnageKg = workout.getDouble("tonnageKg"),
                        score = if (workout.isNull("score")) null else workout.getInt("score"),
                    )
                },
                templates = json.objects("templates").map { template ->
                    AdminTemplate(template.getString("id"), template.getString("format"), template.getString("name"), template.getString("meta"))
                },
            )
        }
    }
}

private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)

private fun JSONObject.strings(key: String): List<String> {
    val array = getJSONArray(key)
    return List(array.length()) { index -> array.getString(index) }
}
