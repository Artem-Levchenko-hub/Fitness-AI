package app.leadgenerator.fitness.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

@Composable
internal fun WalletScreen(request: ScreenRequest, resumeCount: Int, openExternal: (String) -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val result = loadScreenJson("/api/mobile/v1/wallet", refresh + resumeCount, request)
    val wallet = result.data
    var amount by rememberSaveable { mutableStateOf("") }
    var lastPayment by rememberSaveable { mutableStateOf("") }
    var paymentKey by rememberSaveable { mutableStateOf("") }
    var confirm by remember { mutableStateOf<WalletAction?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    VibeList {
        item { VibeHeading("Баланс") }
        if (wallet == null) {
            item { LoadStatus(result) { refresh++ } }
        } else {
            val subscription = wallet.optJSONObject("subscription")
            val recurring = wallet.optBoolean("recurringEnabled")
            item {
                VibeCard {
                    Text("На счету", style = MaterialTheme.typography.titleMedium)
                    Text(rub(wallet.optInt("balanceKopecks")), style = MaterialTheme.typography.headlineLarge)
                    if (wallet.optString("mode") == "test") Text("Тестовый режим платежей")
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                }
            }
            if (wallet.optBoolean("topupEnabled")) {
                item {
                    VibeCard {
                        Text("Пополнить баланс", style = MaterialTheme.typography.headlineSmall)
                        val packages = wallet.optJSONArray("packages")
                        if (packages != null && packages.length() >= 2) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                repeat(2) { index ->
                                    val value = packages.getInt(index)
                                    FilledTonalButton(onClick = { amount = value.toString() }, enabled = !busy) { Text("$value ₽") }
                                }
                            }
                        }
                        val min = wallet.getInt("minTopupRub")
                        val max = wallet.getInt("maxTopupRub")
                        val rub = amount.toIntOrNull()?.takeIf { it in min..max }
                        OutlinedTextField(amount, { amount = it.filter(Char::isDigit).take(6) }, Modifier.fillMaxWidth(),
                            label = { Text("Сумма, ₽") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            enabled = !busy)
                        Button(onClick = { if (rub != null) confirm = WalletAction.Topup(rub) }, enabled = !busy && rub != null) {
                            Text("Продолжить к оплате")
                        }
                    }
                }
            }
            if (subscription?.optBoolean("active") == true) {
                item {
                    VibeCard {
                        Text("Подписка Pro", style = MaterialTheme.typography.headlineSmall)
                        val end = formatWorkoutDate(subscription.optString("currentPeriodEnd"))
                        Text(if (end.isBlank()) "Доступ активен" else "Доступ до $end")
                        if (recurring && subscription.optBoolean("renewalAvailable")) {
                            val paused = subscription.optBoolean("cancelAtPeriodEnd")
                            FilledTonalButton(onClick = { confirm = WalletAction.Renewal(paused) }, enabled = !busy) {
                                Text(if (paused) "Включить продление" else "Выключить продление")
                            }
                        }
                    }
                }
            } else if (wallet.optBoolean("subscriptionsEnabled")) {
                item { Text("Подписка Pro", style = MaterialTheme.typography.headlineSmall) }
                items(wallet.objects("plans"), key = { "plan-${it.getString("code")}" }) { plan ->
                    val planPrice = plan.getInt("priceKopecks")
                    val title = plan.getString("title")
                    VibeCard {
                        Text(title, style = MaterialTheme.typography.titleMedium)
                        Text(rub(planPrice), style = MaterialTheme.typography.headlineSmall)
                        val benefits = plan.optJSONArray("benefits")
                        if (benefits != null) repeat(benefits.length()) { Text(benefits.getString(it)) }
                        Button(enabled = !busy, onClick = {
                            confirm = WalletAction.Subscribe(plan.getString("code"), title, planPrice, recurring)
                        }) { Text("Выбрать тариф") }
                    }
                }
            }
            val history = wallet.objects("transactions")
            if (history.isNotEmpty()) item { Text("Операции", style = MaterialTheme.typography.headlineSmall) }
            items(history, key = { "transaction-${it.getString("id")}" }) { transaction ->
                VibeCard {
                    Text(transaction.optString("description").ifBlank { "Операция по балансу" }, style = MaterialTheme.typography.titleMedium)
                    Text("${rub(transaction.optInt("amountKopecks"))} · ${formatWorkoutDate(transaction.optString("createdAt"))}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }

    confirm?.let { operation ->
        AlertDialog(
            onDismissRequest = { if (!busy) confirm = null },
            title = { Text(operation.title) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(operation.description)
                    if (operation is WalletAction.Subscribe) {
                        TextButton(onClick = { openExternal("$SITE/legal/offer") }) { Text("Условия подписки") }
                    }
                }
            },
            confirmButton = {
                TextButton(enabled = !busy, onClick = {
                    if (busy) return@TextButton
                    busy = true
                    error = ""
                    scope.launch {
                        try {
                            if (lastPayment != operation.key) {
                                lastPayment = operation.key
                                paymentKey = UUID.randomUUID().toString()
                            }
                            val response = request(operation.path, operation.body(paymentKey))
                            val redirect = response.optString("confirmationUrl")
                            if (redirect.startsWith("https://")) {
                                openExternal(redirect)
                            } else if (operation !is WalletAction.Renewal && response.optString("status") != "succeeded") {
                                error = "Сервер не вернул ссылку на оплату."
                            }
                            lastPayment = ""
                            refresh++
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            error = "Не удалось выполнить операцию. Проверьте статус баланса перед повтором."
                        } finally {
                            confirm = null
                            busy = false
                        }
                    }
                }) { Text(if (busy) "Проверяем…" else operation.confirmLabel) }
            },
            dismissButton = { TextButton(enabled = !busy, onClick = { confirm = null }) { Text("Назад") } },
        )
    }
}

private fun rub(kopecks: Int) = "${formatNumber(kopecks / 100.0)} ₽"

private sealed class WalletAction(val key: String, val path: String, val title: String, val description: String, val confirmLabel: String) {
    abstract fun body(id: String): JSONObject

    class Topup(private val amount: Int) : WalletAction(
        "topup-$amount", "/api/yookassa/checkout", "Пополнить на $amount ₽?", "Подтверждение оплаты откроется в ЮKassa.", "К оплате",
    ) {
        override fun body(id: String) = JSONObject().put("amountRub", amount).put("idempotencyKey", id)
    }

    class Subscribe(private val code: String, title: String, price: Int, private val recurring: Boolean) : WalletAction(
        "subscription-$code-$recurring", "/api/yookassa/subscription/checkout", title,
        if (recurring) "Подтвердите условия регулярных списаний по ${rub(price)} согласно тарифу."
        else "Подтвердите условия разовой оплаты ${rub(price)} за период тарифа.", "Согласен, к оплате",
    ) {
        override fun body(id: String) = JSONObject().put("planCode", code).put("idempotencyKey", id)
            .put("paymentMode", if (recurring) "recurring" else "one_time").put("acceptTerms", true)
    }

    class Renewal(enable: Boolean) : WalletAction(
        "renewal-$enable", if (enable) "/api/yookassa/subscription/resume" else "/api/yookassa/subscription/cancel",
        if (enable) "Включить автопродление?" else "Выключить автопродление?",
        if (enable) "После окончания оплаченного периода подписка продлится по действующим условиям."
        else "Доступ сохранится до конца оплаченного периода.", "Подтвердить",
    ) {
        override fun body(id: String) = JSONObject()
    }
}
