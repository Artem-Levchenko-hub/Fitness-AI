package app.leadgenerator.fitness.nativeapp

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.security.KeyStore
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal const val SITE = "https://fitnesss.online"
internal class HttpFailure(val code: Int, val reason: String? = null) : IOException("HTTP $code")

internal class JournalApi(context: Context) {
    private val origin = SITE.toHttpUrl()
    private val session = EncryptedSessionJar(context, origin)
    private val client = OkHttpClient.Builder()
        .cookieJar(session)
        .followRedirects(false)
        .callTimeout(20, TimeUnit.SECONDS)
        .build()
    private val analysisClient = client.newBuilder()
        .readTimeout(65, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(75, TimeUnit.SECONDS)
        .build()

    fun snapshot(): JSONObject = authenticated { json(Request.Builder().url(url(JOURNAL_PATH)).build()) }

    fun request(path: String, body: JSONObject? = null): JSONObject = authenticated {
        val request = buildRequest(path, body)
        if (path == "/api/ai/coach/finalize") JSONObject(responseText(request, analysisClient)) else json(request)
    }

    fun coach(body: JSONObject): String = authenticated {
        responseText(buildRequest("/api/ai/coach", body), analysisClient)
    }

    fun videoTechnique(workoutId: String, exerciseId: String, requestId: String, bytes: ByteArray): JSONObject = authenticated {
        val address = url("/api/ai/video-technique").newBuilder()
            .addQueryParameter("workoutId", workoutId)
            .addQueryParameter("exerciseId", exerciseId)
            .addQueryParameter("requestId", requestId).build()
        val request = Request.Builder().url(address).post(bytes.toRequestBody(VIDEO_MEDIA_TYPE)).build()
        JSONObject(responseText(request, analysisClient))
    }

    fun upload(set: QueuedSet): Unit = authenticated {
        val request = Request.Builder().url(url(JOURNAL_PATH))
            .post(set.payload().toString().toRequestBody(JSON_MEDIA_TYPE)).build()
        val acknowledgement = json(request)
        if (acknowledgement.optString("clientSetId") != set.entry.id) throw IOException("Invalid set acknowledgement")
    }

    fun requestCode(email: String) {
        val csrf = csrfToken()
        val form = FormBody.Builder().add("csrfToken", csrf).add("email", email)
            .add("callbackUrl", "$SITE/dashboard").build()
        val request = Request.Builder().url(url("/api/auth/signin/resend"))
            .header("X-Auth-Return-Redirect", "1").post(form).build()
        client.newCall(request).execute().use { response ->
            val location = if (response.isRedirect) response.header("Location") else {
                if (!response.isSuccessful) throw HttpFailure(response.code)
                JSONObject(response.body?.string().orEmpty()).optString("url")
            }
            val destination = location?.let(origin::resolve)
            // With redirects disabled, Auth.js returns its verification endpoint before the custom page.
            if (destination == null || destination.host != origin.host ||
                destination.encodedPath !in setOf("/api/auth/verify-request", "/login/verify")) {
                throw IOException("Couldn't request an email code")
            }
        }
    }

    fun verifyCode(email: String, code: String) {
        val address = url("/api/auth/callback/resend").newBuilder()
            .addQueryParameter("email", email).addQueryParameter("token", code)
            .addQueryParameter("callbackUrl", "$SITE/dashboard").build()
        client.newCall(Request.Builder().url(address).build()).execute().use { response ->
            val destination = response.header("Location")?.let(origin::resolve)
            if (!response.isRedirect || destination == null || destination.host != origin.host || destination.encodedPath != "/dashboard") {
                throw HttpFailure(401)
            }
        }
    }

    fun hasSession(): Boolean = session.hasSession()

    fun signOut() {
        try {
            val form = FormBody.Builder().add("csrfToken", csrfToken()).add("callbackUrl", SITE).build()
            val request = Request.Builder().url(url("/api/auth/signout")).post(form).build()
            client.newCall(request).execute().close()
        } catch (_: IOException) {
            // Removing the on-device credentials also works offline.
        } finally {
            session.clear()
        }
    }

    private fun <T> authenticated(call: () -> T): T {
        try {
            return call()
        } catch (failure: HttpFailure) {
            if (failure.code != 401 || !session.hasRefreshCookie()) throw failure
        }
        client.newCall(Request.Builder().url(url("/api/auth/restore?next=/dashboard")).build())
            .execute().close()
        return call()
    }

    private fun csrfToken(): String = json(Request.Builder().url(url("/api/auth/csrf")).build()).getString("csrfToken")

    private fun buildRequest(path: String, body: JSONObject?): Request = Request.Builder().url(url(path)).apply {
        if (body != null) post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
    }.build()

    private fun json(request: Request): JSONObject = JSONObject(responseText(request, client))

    private fun responseText(request: Request, http: OkHttpClient): String = http.newCall(request).execute().use { response ->
        val text = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            val reason = runCatching { JSONObject(text).optString("error").ifBlank { null } }.getOrNull()
            val redirectedToLogin = response.isRedirect && response.header("Location")
                ?.let(origin::resolve)?.encodedPath == "/login"
            throw HttpFailure(if (redirectedToLogin) 401 else response.code, reason)
        }
        text
    }

    private fun url(path: String): HttpUrl = requireNotNull(origin.resolve(path)).also {
        require(it.isHttps && it.host == origin.host && it.port == origin.port)
    }

    private companion object {
        const val JOURNAL_PATH = "/api/mobile/v1/journal"
        val JSON_MEDIA_TYPE = "application/json".toMediaType()
        val VIDEO_MEDIA_TYPE = "video/mp4".toMediaType()
    }
}

private class EncryptedSessionJar(context: Context, private val origin: HttpUrl) : CookieJar {
    private val preferences = context.getSharedPreferences("journal_session", Context.MODE_PRIVATE)
    private val persistentNames = setOf("fitness-refresh-token", "authjs.session-token")
    private val cookies = mutableMapOf<String, Cookie>()

    init {
        val saved = preferences.getString("sealed", null)
        if (saved != null) {
            runCatching {
                val bytes = Base64.decode(saved, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
                val records = JSONArray(cipher.doFinal(bytes.copyOfRange(12, bytes.size)).decodeToString())
                for (i in 0 until records.length()) {
                    Cookie.parse(origin, records.getString(i))?.let { cookies[it.name] = it }
                }
            }.onFailure { clear() }
        }
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (!url.isHttps || url.host != origin.host) return
        var save = false
        for (cookie in cookies.filter { it.domain == origin.host }) {
            if (cookie.expiresAt <= System.currentTimeMillis()) this.cookies.remove(cookie.name)
            else this.cookies[cookie.name] = cookie
            save = save || isPersistent(cookie.name)
        }
        if (save) persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        if (!url.isHttps || url.host != origin.host) return emptyList()
        return cookies.values.filter { it.expiresAt > System.currentTimeMillis() && it.matches(url) }
    }

    @Synchronized
    fun hasRefreshCookie(): Boolean = loadForRequest(origin).any { it.name == "fitness-refresh-token" }

    @Synchronized
    fun hasSession(): Boolean = loadForRequest(origin).any { isPersistent(it.name) }

    @Synchronized
    fun clear() {
        cookies.clear()
        check(preferences.edit().remove("sealed").commit())
    }

    private fun isPersistent(name: String) = name in persistentNames || name.startsWith("authjs.session-token.")

    private fun persist() {
        val saved = JSONArray(cookies.values.filter { isPersistent(it.name) }.map { it.toString() })
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val bytes = cipher.iv + cipher.doFinal(saved.toString().encodeToByteArray())
        check(preferences.edit().putString("sealed", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit())
    }

    private fun key(): SecretKey {
        val alias = "fitness_journal_session_key"
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }
}
