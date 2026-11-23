package app.leadgenerator.fitness.nativeapp

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.android.filament.Colors
import com.google.android.filament.IndirectLight
import com.google.android.filament.MaterialInstance
import com.google.android.filament.Skybox
import com.google.android.filament.utils.Float3
import com.google.android.filament.utils.Manipulator
import com.google.android.filament.utils.ModelViewer
import com.google.android.filament.utils.Utils
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer

/** Native Filament surface. No network model fetch and no WebView. */
@Composable
internal fun NativeMuscleModel(
    muscles: List<BodyMuscle>, selected: String?, onSelect: (String?) -> Unit, modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var model by remember { mutableStateOf<ByteBuffer?>(null) }
    var error by remember { mutableStateOf(false) }
    var ready by remember { mutableStateOf(false) }
    var host by remember { mutableStateOf<BodyModelHost?>(null) }

    LaunchedEffect(context) {
        try {
            model = withContext(Dispatchers.IO) {
                context.assets.open("models/muscles.glb").use { ByteBuffer.wrap(it.readBytes()) }
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { error = true }
    }
    DisposableEffect(lifecycle, host) {
        val observer = LifecycleEventObserver { _, _ ->
            host?.setResumed(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
        }
        lifecycle.addObserver(observer)
        host?.setResumed(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
        onDispose { lifecycle.removeObserver(observer); host?.setResumed(false) }
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        if (!error) {
            AndroidView(
                modifier = Modifier.matchParentSize().semantics { contentDescription = "Интерактивная 3D-модель мышц. Вращение пальцем, выбор мышцы нажатием." },
                factory = { BodyModelHost(it, onFailure = { error = true }, onReady = { ready = true }).also { view -> host = view } },
                onRelease = { it.setResumed(false) },
                update = { it.update(model, muscles, selected, onSelect) },
            )
        }
        if (error) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("3D-модель недоступна на этом устройстве", style = MaterialTheme.typography.titleMedium)
                Text("Нагрузка и история каждой мышцы доступны в списке ниже.", style = MaterialTheme.typography.bodySmall)
            }
        } else if (!ready) CircularProgressIndicator(Modifier.size(28.dp))
    }
}

/** Each attachment gets a new SurfaceView because ModelViewer destroys its engine on detach. */
private class BodyModelHost(context: Context, val onFailure: () -> Unit, val onReady: () -> Unit) : FrameLayout(context) {
    private var surface: MuscleSurface? = null
    private var buffer: ByteBuffer? = null
    private var muscles: List<BodyMuscle> = emptyList()
    private var selected: String? = null
    private var select: (String?) -> Unit = {}
    private var resumed = false

    fun update(nextBuffer: ByteBuffer?, data: List<BodyMuscle>, key: String?, onSelect: (String?) -> Unit) {
        buffer = nextBuffer; muscles = data; selected = key; select = onSelect
        surface?.update(buffer, muscles, selected, select)
    }

    fun setResumed(value: Boolean) { resumed = value; surface?.setResumed(value) }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        try {
            Utils.init()
            val next = MuscleSurface(context, onFailure, onReady)
            surface = next
            addView(next, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            next.update(buffer, muscles, selected, select)
            next.setResumed(resumed)
        } catch (_: Exception) { onFailure() }
        catch (_: LinkageError) { onFailure() }
    }

    override fun onDetachedFromWindow() {
        // The child's detach releases materials, then ModelViewer frees its engine.
        surface = null
        removeAllViews()
        super.onDetachedFromWindow()
    }
}

@SuppressLint("ClickableViewAccessibility")
private class MuscleSurface(context: Context, val onFailure: () -> Unit, val onReady: () -> Unit) : SurfaceView(context), Choreographer.FrameCallback {
    private val viewer = ModelViewer(this, manipulator = Manipulator.Builder()
        .targetPosition(0f, 0f, 0f).orbitHomePosition(0f, 0f, 3.6f)
        .zoomSpeed(0.015f).build(Manipulator.Mode.ORBIT))
    private val materials = mutableMapOf<Int, Pair<String?, List<MaterialInstance>>>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val choreographer = Choreographer.getInstance()
    private var loadedBuffer: ByteBuffer? = null
    private var select: (String?) -> Unit = {}
    private var resumed = false
    private var disposed = false
    private var frameScheduled = false
    private var framesRemaining = 0
    private var reportedReady = false
    private val skybox = Skybox.Builder().color(0.94f, 0.94f, 0.90f, 1f).build(viewer.engine)
    private val ambient = IndirectLight.Builder().irradiance(1, floatArrayOf(0.8f, 0.8f, 0.8f)).intensity(25_000f).build(viewer.engine)
    private val taps = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(event: MotionEvent) = true
        override fun onSingleTapUp(event: MotionEvent): Boolean {
            performClick()
            if (disposed || loadedBuffer == null) return true
            viewer.view.pick(event.x.toInt().coerceIn(0, (width - 1).coerceAtLeast(0)),
                (height - 1 - event.y.toInt()).coerceIn(0, (height - 1).coerceAtLeast(0)), mainHandler) { result ->
                if (!disposed) select(materials[result.renderable]?.first)
            }
            invalidateModel(6)
            return true
        }
    })

    init {
        viewer.scene.skybox = skybox
        viewer.scene.indirectLight = ambient
        viewer.cameraFocalLength = 32f
        val lights = viewer.engine.lightManager
        lights.setDirection(lights.getInstance(viewer.light), -0.4f, -0.6f, -1f)
        setOnTouchListener { _, event ->
            if (disposed) false else {
                parent?.requestDisallowInterceptTouchEvent(event.actionMasked != MotionEvent.ACTION_UP && event.actionMasked != MotionEvent.ACTION_CANCEL)
                taps.onTouchEvent(event)
                viewer.onTouchEvent(event)
                invalidateModel(12)
                true
            }
        }
    }

    fun update(buffer: ByteBuffer?, muscles: List<BodyMuscle>, selected: String?, onSelect: (String?) -> Unit) {
        if (disposed) return
        select = onSelect
        try {
            if (buffer != null && loadedBuffer !== buffer) {
                viewer.loadModelGlb(buffer.duplicate())
                val asset = checkNotNull(viewer.asset) { "Invalid muscle model" }
                viewer.transformToUnitCube(Float3(0f, 0f, 0f))
                val manager = viewer.engine.renderableManager
                // The web GLB deliberately shares one neutral material. Give every group
                // its own instances, otherwise highlighting one group colors all of them.
                for (entity in asset.renderableEntities) {
                    val instance = manager.getInstance(entity)
                    val copies = (0 until manager.getPrimitiveCount(instance)).map { primitive ->
                        MaterialInstance.duplicate(manager.getMaterialInstanceAt(instance, primitive), null).also {
                            manager.setMaterialInstanceAt(instance, primitive, it)
                        }
                    }
                    materials[entity] = asset.getName(entity) to copies
                }
                loadedBuffer = buffer
            }
            val data = muscles.associateBy { it.key }
            materials.values.forEach { (key, instances) ->
                val datum = data[key]
                val color = runCatching { android.graphics.Color.parseColor(datum?.color ?: "#7a7a72") }.getOrDefault(android.graphics.Color.GRAY)
                val dim = if (selected != null && selected != key) 0.32f else 1f
                val red = android.graphics.Color.red(color) / 255f * dim
                val green = android.graphics.Color.green(color) / 255f * dim
                val blue = android.graphics.Color.blue(color) / 255f * dim
                instances.forEach { it.setParameter("baseColorFactor", Colors.RgbaType.SRGB, red, green, blue, 1f) }
            }
            invalidateModel(6)
        } catch (_: Exception) { fail() }
    }

    fun setResumed(value: Boolean) {
        resumed = value
        if (value) invalidateModel(6) else {
            choreographer.removeFrameCallback(this)
            frameScheduled = false
        }
    }

    private fun invalidateModel(frames: Int) {
        framesRemaining = maxOf(framesRemaining, frames)
        if (!disposed && resumed && !frameScheduled) {
            frameScheduled = true
            choreographer.postFrameCallback(this)
        }
    }

    override fun doFrame(frameTimeNanos: Long) {
        frameScheduled = false
        if (disposed || !resumed) return
        try {
            viewer.render(frameTimeNanos)
            if (loadedBuffer != null && viewer.progress >= 1f && !reportedReady) {
                reportedReady = true
                onReady()
            }
            framesRemaining--
            if (framesRemaining > 0 || (loadedBuffer != null && !reportedReady)) invalidateModel(1)
        } catch (_: Exception) { fail() }
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        invalidateModel(6)
    }

    override fun performClick(): Boolean { super.performClick(); return true }

    private fun fail() { setResumed(false); onFailure() }

    override fun onDetachedFromWindow() {
        // This callback runs before ModelViewer's attach-state listener destroys
        // the engine. Release only our extra resources here; never destroy twice.
        disposed = true
        choreographer.removeFrameCallback(this)
        viewer.destroyModel()
        materials.values.flatMap { it.second }.forEach { viewer.engine.destroyMaterialInstance(it) }
        materials.clear()
        viewer.scene.skybox = null
        viewer.scene.indirectLight = null
        viewer.engine.destroySkybox(skybox)
        viewer.engine.destroyIndirectLight(ambient)
        super.onDetachedFromWindow()
    }
}
