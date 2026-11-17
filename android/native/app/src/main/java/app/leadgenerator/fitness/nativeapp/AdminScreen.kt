package app.leadgenerator.fitness.nativeapp

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SecondaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

private const val ADMIN_PATH = "/api/mobile/v1/admin"

private enum class AdminSection(val label: String) {
    Overview("Обзор"), Users("Пользователи"), Payments("Платежи"),
}

private data class AdminNotice(val text: String, val error: Boolean = false)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AdminScreen(request: suspend (String, JSONObject?) -> JSONObject, onBack: () -> Unit) {
    val fetch by rememberUpdatedState(request)
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current
    var section by remember { mutableStateOf(AdminSection.Overview) }
    var overview by remember { mutableStateOf<AdminOverview?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var selectedUser by remember { mutableStateOf<AdminUser?>(null) }
    var refundPayment by remember { mutableStateOf<AdminPayment?>(null) }
    var sendingRefund by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<AdminNotice?>(null) }

    fun refresh() {
        overview = null
        loadError = null
        revision++
    }

    fun back() {
        if (sendingRefund) return
        if (selectedUser == null) onBack() else selectedUser = null
    }

    LaunchedEffect(revision) {
        try {
            overview = AdminOverview.fromJson(fetch(ADMIN_PATH, null))
        } catch (failure: Exception) {
            if (failure is CancellationException) throw failure
            loadError = adminReadError(failure, "Не удалось загрузить админ-панель. Проверьте подключение.")
        }
    }

    BackHandler { back() }

    val user = selectedUser
    val dashboard = overview
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = ::back, enabled = !sendingRefund) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, if (user == null) "Назад" else "К пользователям")
                }
                Text(
                    if (user == null) "Админ-панель" else "Пользователь",
                    Modifier.weight(1f),
                    style = MaterialTheme.typography.titleLarge,
                )
                if (user == null) {
                    IconButton(onClick = ::refresh, enabled = !sendingRefund && (dashboard != null || loadError != null)) {
                        Icon(Icons.Default.Refresh, "Обновить данные админ-панели")
                    }
                }
            }

            if (user != null) {
                key(user.id) {
                    AdminUserScreen(user, request, onUnavailable = {
                        selectedUser = null
                        notice = AdminNotice("Профиль больше недоступен.", error = true)
                        refresh()
                    })
                }
            } else if (dashboard == null) {
                VibeList {
                    notice?.let { message -> item { AdminStatusMessage(message) { notice = null } } }
                    item { AdminLoadMessage(loadError, "Загружаем админ-панель…", ::refresh) }
                }
            } else {
                SecondaryTabRow(selectedTabIndex = section.ordinal) {
                    AdminSection.entries.forEach { item ->
                        Tab(selected = section == item, onClick = { section = item }, text = { Text(item.label) })
                    }
                }
                key(section) {
                    VibeList {
                        notice?.let { message -> item { AdminStatusMessage(message) { notice = null } } }
                        when (section) {
                            AdminSection.Overview -> {
                                item { AdminSummaryCard(dashboard.summary) }
                                item { AdminBillingCard(dashboard.billing) }
                            }
                            AdminSection.Users -> {
                                item {
                                    OutlinedTextField(
                                        value = query,
                                        onValueChange = { query = it },
                                        modifier = Modifier.fillMaxWidth(),
                                        label = { Text("Поиск по имени или email") },
                                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Search),
                                        keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
                                        singleLine = true,
                                    )
                                }
                                val search = query.trim()
                                val users = dashboard.users.filter { user ->
                                    user.name?.contains(search, ignoreCase = true) == true || user.email.contains(search, ignoreCase = true)
                                }
                                if (users.isEmpty()) {
                                    item { AdminEmpty(if (search.isEmpty()) "Пользователей пока нет." else "Пользователи не найдены.") }
                                }
                                items(users, key = { it.id }) { user -> AdminUserCard(user) { selectedUser = user } }
                            }
                            AdminSection.Payments -> {
                                if (dashboard.payments.isEmpty()) item { AdminEmpty("Платежей пока нет.") }
                                items(dashboard.payments, key = { it.id }) { payment ->
                                    AdminPaymentCard(payment, allowRefund = !sendingRefund) { refundPayment = payment }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    refundPayment?.let { payment ->
        AdminRefundDialog(payment, sendingRefund, onDismiss = { refundPayment = null }) { reason ->
            val validReason = validAdminRefundReason(reason, payment.canRequestRefund)
            if (!sendingRefund && validReason != null) {
                sendingRefund = true
                scope.launch {
                    try {
                        val result = fetch("/api/admin/payments/${Uri.encode(payment.id)}/refund", JSONObject().put("reason", validReason))
                        val status = if (result.optString("paymentId") == payment.id) result.optString("status") else ""
                        notice = when (AdminRefundResult.fromStatus(status)) {
                            AdminRefundResult.Refunded -> AdminNotice("Возврат выполнен.")
                            AdminRefundResult.Pending -> AdminNotice("Возврат передан в ЮKassa и ещё обрабатывается.")
                            AdminRefundResult.Canceled -> AdminNotice("ЮKassa отменила возврат.", error = true)
                            AdminRefundResult.Unknown -> AdminNotice("Статус возврата не подтверждён. Проверьте состояние платежа.", error = true)
                        }
                    } catch (failure: Exception) {
                        if (failure is CancellationException) throw failure
                        notice = AdminNotice(adminRefundError(failure), error = true)
                    } finally {
                        sendingRefund = false
                        refundPayment = null
                    }
                    refresh()
                }
            }
        }
    }
}

@Composable
private fun AdminSummaryCard(summary: AdminSummary) {
    VibeCard {
        Text("Активность", style = MaterialTheme.typography.headlineSmall)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AdminMetric("Пользователей", formatNumber(summary.userCount, 0), Modifier.weight(1f), large = true)
            AdminMetric("Активны за 7 дней", formatNumber(summary.active7d, 0), Modifier.weight(1f), large = true)
        }
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AdminMetric("Куплено кредитов", formatAdminAmount(summary.totalPurchasedKopecks), Modifier.weight(1f), large = true)
            AdminMetric("Потрачено кредитов", formatAdminAmount(summary.totalSpentKopecks), Modifier.weight(1f), large = true)
        }
    }
}

@Composable
private fun AdminBillingCard(billing: AdminBilling) {
    VibeCard {
        Text("Платёжный контур", style = MaterialTheme.typography.headlineSmall)
        Text(
            if (billing.mode == "live") "ЮKassa · боевой режим" else "ЮKassa · тестовый режим",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        HorizontalDivider()
        AdminReadiness("Пополнения", billing.paymentsEnabled)
        AdminReadiness("Подписки", billing.subscriptionsEnabled)
        AdminReadiness("Автопродление", billing.recurringPaymentsEnabled)
        if (billing.paymentMissing.isNotEmpty()) {
            Text("Для пополнений нужны ${billing.paymentMissing.joinToString()}", style = MaterialTheme.typography.bodySmall)
        }
        val subscriptionMissing = billing.subscriptionMissing - billing.paymentMissing.toSet()
        if (subscriptionMissing.isNotEmpty()) {
            Text("Для подписок дополнительно нужны ${subscriptionMissing.joinToString()}", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun AdminReadiness(label: String, enabled: Boolean) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        AdminStatusPill(if (enabled) "Готово" else "Выключено", enabled)
    }
}

@Composable
private fun AdminUserCard(user: AdminUser, onClick: () -> Unit) {
    VibeCard(Modifier.clip(MaterialTheme.shapes.large).clickable(role = Role.Button, onClick = onClick)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(user.displayName, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (user.displayName != user.email) {
                    Text(user.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val activity = user.lastActivityAt?.let(::formatWorkoutDate)
        Text(
            if (activity.isNullOrEmpty()) "Нет завершённых тренировок" else "Активность $activity",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AdminMetric("Тренировок", formatNumber(user.workoutCount, 0), Modifier.weight(1f))
            AdminMetric("Потрачено", formatAdminAmount(user.totalSpentKopecks), Modifier.weight(1f))
            AdminMetric("Баланс", formatAdminAmount(user.balanceKopecks), Modifier.weight(1f))
        }
    }
}

@Composable
private fun AdminPaymentCard(payment: AdminPayment, allowRefund: Boolean, onRefund: () -> Unit) {
    VibeCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(formatAdminAmount(payment.amountKopecks), style = MaterialTheme.typography.titleLarge)
                Text(paymentKind(payment.kind), style = MaterialTheme.typography.bodyMedium)
            }
            AdminStatusPill(paymentStatus(payment.status), emphasized = payment.status == "succeeded" || payment.status == "refunded")
        }
        Text(payment.userEmail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        val date = formatWorkoutDate(payment.createdAt)
        val refundedAt = payment.refundedAt?.let(::formatWorkoutDate)
        Text(
            if (refundedAt.isNullOrEmpty()) date else "$date · Возврат $refundedAt",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (payment.canRequestRefund) {
            OutlinedButton(enabled = allowRefund, onClick = onRefund) { Text("Оформить возврат") }
        }
    }
}

@Composable
private fun AdminUserScreen(
    user: AdminUser,
    request: suspend (String, JSONObject?) -> JSONObject,
    onUnavailable: () -> Unit,
) {
    val fetch by rememberUpdatedState(request)
    val unavailable by rememberUpdatedState(onUnavailable)
    var detail by remember { mutableStateOf<AdminUserDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableIntStateOf(0) }

    LaunchedEffect(user.id, revision) {
        try {
            detail = AdminUserDetail.fromJson(fetch("$ADMIN_PATH/users/${Uri.encode(user.id)}", null)).also {
                check(it.id == user.id)
            }
        } catch (failure: Exception) {
            if (failure is CancellationException) throw failure
            if (failure is HttpFailure && failure.code in setOf(401, 403, 404)) unavailable()
            else error = "Не удалось загрузить профиль. Проверьте подключение."
        }
    }

    val profile = detail
    VibeList {
        if (profile == null) {
            item {
                AdminLoadMessage(error, "Загружаем профиль…") {
                    error = null
                    revision++
                }
            }
        } else {
            item { AdminProfileCard(user, profile) }
            if (profile.templates.isNotEmpty()) {
                item { Text("Шаблоны", style = MaterialTheme.typography.headlineSmall) }
                items(profile.templates, key = { "template-${it.format}-${it.id}" }) { template ->
                    VibeCard {
                        Text(template.name, style = MaterialTheme.typography.titleMedium)
                        Text(template.meta, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item { Text("Последние силовые тренировки", style = MaterialTheme.typography.headlineSmall) }
            if (profile.workouts.isEmpty()) item { AdminEmpty("Завершённых силовых тренировок пока нет.") }
            items(profile.workouts, key = { "workout-${it.id}" }) { workout -> AdminWorkoutCard(workout) }
        }
    }
}

@Composable
private fun AdminProfileCard(user: AdminUser, profile: AdminUserDetail) {
    VibeCard {
        Text(profile.displayName, style = MaterialTheme.typography.headlineMedium)
        if (profile.displayName != profile.email) Text(profile.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Регистрация ${formatWorkoutDate(user.createdAt)}", style = MaterialTheme.typography.bodySmall)
        val measures = listOfNotNull(profile.heightCm?.let { "$it см" }, profile.weightKg?.let { "${formatNumber(it)} кг" })
        if (measures.isNotEmpty()) Text(measures.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AdminMetric("Силовые", formatNumber(user.strengthCount, 0), Modifier.weight(1f))
            AdminMetric("Круговые", formatNumber(user.circuitCount, 0), Modifier.weight(1f))
            AdminMetric("Кардио", formatNumber(user.cardioCount, 0), Modifier.weight(1f))
        }
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AdminMetric("Куплено", formatAdminAmount(user.totalPurchasedKopecks), Modifier.weight(1f))
            AdminMetric("Потрачено", formatAdminAmount(user.totalSpentKopecks), Modifier.weight(1f))
            AdminMetric("Баланс", formatAdminAmount(user.balanceKopecks), Modifier.weight(1f))
        }
        Text("Тариф ${user.tier ?: "free"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AdminWorkoutCard(workout: AdminWorkout) {
    VibeCard {
        Text(workout.name, style = MaterialTheme.typography.titleMedium)
        Text(formatWorkoutDate(workout.startedAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AdminMetric("Подходы", formatNumber(workout.setCount, 0), Modifier.weight(1f))
            AdminMetric("Объём, кг", formatNumber(workout.tonnageKg, 0), Modifier.weight(1f))
            workout.finishedAt?.let { finished ->
                val minutes = runCatching {
                    ((Duration.between(Instant.parse(workout.startedAt), Instant.parse(finished)).seconds + 30) / 60).coerceAtLeast(1)
                }.getOrNull()
                if (minutes != null) AdminMetric("Минуты", formatNumber(minutes, 0), Modifier.weight(1f))
            }
        }
        workout.score?.let { AdminStatusPill("Оценка ИИ $it", emphasized = true) }
    }
}

@Composable
private fun AdminRefundDialog(payment: AdminPayment, busy: Boolean, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var reason by remember(payment.id) { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(dismissOnBackPress = !busy, dismissOnClickOutside = !busy),
        title = { Text("Вернуть ${formatAdminAmount(payment.amountKopecks)}?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(payment.userEmail, style = MaterialTheme.typography.titleMedium)
                Text("Полная сумма резервируется на балансе пользователя и отправляется в ЮKassa.")
                OutlinedTextField(
                    value = reason,
                    onValueChange = { if (it.length <= 500) reason = it },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    label = { Text("Причина возврата") },
                    supportingText = { Text("От 3 до 500 символов. Причина сохранится в аудите.") },
                    minLines = 2,
                    maxLines = 3,
                )
            }
        },
        confirmButton = {
            Button(
                enabled = !busy && validAdminRefundReason(reason, payment.canRequestRefund) != null,
                onClick = { onConfirm(reason) },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
            ) { Text(if (busy) "Оформляем…" else "Подтвердить возврат") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Отмена") } },
    )
}

@Composable
private fun AdminMetric(label: String, value: String, modifier: Modifier = Modifier, large: Boolean = false) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(value, style = if (large) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AdminStatusPill(label: String, emphasized: Boolean) {
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = if (emphasized) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh,
        contentColor = if (emphasized) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
    ) {
        Text(label, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun AdminLoadMessage(error: String?, loading: String, onRetry: () -> Unit) {
    VibeCard {
        if (error == null) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Text(loading)
            }
        } else {
            Text(error, color = MaterialTheme.colorScheme.error)
            OutlinedButton(onClick = onRetry) { Text("Повторить") }
        }
    }
}

@Composable
private fun AdminStatusMessage(notice: AdminNotice, onDismiss: () -> Unit) {
    VibeCard(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(notice.text, color = if (notice.error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
        TextButton(onClick = onDismiss) { Text("Закрыть") }
    }
}

@Composable
private fun AdminEmpty(text: String) {
    VibeCard { Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant) }
}

private fun formatAdminAmount(kopecks: Long): String = "${formatNumber(BigDecimal.valueOf(kopecks, 2))} ₽"

private fun paymentKind(kind: String): String = when (kind) {
    "topup" -> "Пополнение"
    "subscription_initial" -> "Подписка"
    "subscription_renewal" -> "Продление подписки"
    else -> kind
}

private fun paymentStatus(status: String): String = when (status) {
    "pending" -> "Ожидает оплаты"
    "waiting_for_capture" -> "Ожидает подтверждения"
    "succeeded" -> "Оплачен"
    "canceled" -> "Отменён"
    "failed" -> "Ошибка оплаты"
    "refund_pending" -> "Возврат в обработке"
    "refunded" -> "Возвращён"
    else -> status
}

private fun adminReadError(failure: Exception, fallback: String): String = when ((failure as? HttpFailure)?.code) {
    401 -> "Войдите в аккаунт снова, чтобы открыть админ-панель."
    403, 404 -> "Админ-панель недоступна для этого аккаунта."
    else -> fallback
}

private fun adminRefundError(failure: Exception): String {
    val reason = (failure as? HttpFailure)?.reason
    return when (reason) {
        "credited_funds_already_used" -> "Средства уже израсходованы. Возврат недоступен."
        "payment_not_refundable" -> "Для этого платежа возврат недоступен."
        "payment_not_found" -> "Платёж больше недоступен."
        "refund_reason_required" -> "Укажите причину возврата от 3 до 500 символов."
        "manual_review_required" -> "Для возврата нужна проверка в кабинете ЮKassa."
        "provider_unavailable" -> "ЮKassa недоступна. Проверьте статус платежа."
        else -> adminReadError(failure, "Статус возврата не подтверждён. Проверьте состояние платежа.")
    }
}
