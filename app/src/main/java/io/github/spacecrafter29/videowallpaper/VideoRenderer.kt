package io.github.spacecrafter29.videowallpaper

import android.content.Context
import android.graphics.SurfaceTexture
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Rendert ein Video auf die Surface eines Live-Wallpapers.
 *
 * Ein MediaPlayer allein kann nicht: er streckt das Bild immer auf die volle
 * Surface-Groesse und verzerrt damit jedes Video, dessen Seitenverhaeltnis nicht
 * exakt dem Bildschirm entspricht. Deshalb geht das Bild ueber eine SurfaceTexture
 * in einen OpenGL-Shader, der Zuschnitt, Helligkeit und Parallax uebernimmt.
 *
 * Alle GL- und MediaPlayer-Aufrufe passieren auf einem eigenen Thread; die
 * oeffentlichen Methoden koennen von jedem Thread aufgerufen werden.
 */
class VideoRenderer(private val context: Context) : SurfaceTexture.OnFrameAvailableListener {

    private companion object {
        const val TAG = "VideoRenderer"

        const val VERTEX_SHADER = """
            attribute vec4 aPosition;
            attribute vec2 aTexCoord;
            uniform mat4 uTexMatrix;
            uniform vec2 uScale;
            uniform vec2 uTranslate;
            varying vec2 vTexCoord;
            varying vec2 vRaw;
            void main() {
                gl_Position = aPosition;
                vec2 coord = (aTexCoord - 0.5) * uScale + 0.5 + uTranslate;
                vRaw = coord;
                vTexCoord = (uTexMatrix * vec4(coord, 0.0, 1.0)).xy;
            }
        """

        const val FRAGMENT_SHADER = """
            #extension GL_OES_EGL_image_external : require
            precision mediump float;
            varying vec2 vTexCoord;
            varying vec2 vRaw;
            uniform samplerExternalOES uTexture;
            uniform float uBrightness;
            void main() {
                if (vRaw.x < 0.0 || vRaw.x > 1.0 || vRaw.y < 0.0 || vRaw.y > 1.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    vec3 rgb = texture2D(uTexture, vTexCoord).rgb * uBrightness;
                    gl_FragColor = vec4(rgb, 1.0);
                }
            }
        """

        val QUAD_POSITIONS = floatArrayOf(
            -1f, -1f,
            1f, -1f,
            -1f, 1f,
            1f, 1f
        )

        val QUAD_TEX_COORDS = floatArrayOf(
            0f, 0f,
            1f, 0f,
            0f, 1f,
            1f, 1f
        )
    }

    private var thread: HandlerThread? = null
    private var handler: Handler? = null

    // Ab hier nur noch vom Render-Thread anfassen.
    private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    private var program = 0
    private var aPosition = 0
    private var aTexCoord = 0
    private var uTexMatrix = 0
    private var uScale = 0
    private var uTranslate = 0
    private var uBrightness = 0
    private var textureId = 0

    private var surfaceTexture: SurfaceTexture? = null
    private var playerSurface: Surface? = null
    private var player: MediaPlayer? = null

    private var surfaceWidth = 0
    private var surfaceHeight = 0
    private var videoInfo: VideoInfo? = null

    private var settings = WallpaperSettings(null, true, 100, true, 100, false)
    private var visible = false
    private var xOffset = 0.5f
    private var appliedSpeed = 0f

    private val drawRunnable = Runnable { drawFrame() }
    private val texMatrix = FloatArray(16)
    private val positionBuffer: FloatBuffer = QUAD_POSITIONS.toFloatBuffer()
    private val texCoordBuffer: FloatBuffer = QUAD_TEX_COORDS.toFloatBuffer()

    // ---------------------------------------------------------------- oeffentlich

    fun start(surface: Surface, width: Int, height: Int, initial: WallpaperSettings) {
        val handlerThread = HandlerThread("VideoWallRender").also { it.start() }
        val threadHandler = Handler(handlerThread.looper)
        thread = handlerThread
        handler = threadHandler
        threadHandler.post {
            surfaceWidth = width
            surfaceHeight = height
            settings = initial
            if (initEgl(surface) && initGl()) {
                clearToBlack()
                openPlayer()
            } else {
                releaseAll()
            }
        }
    }

    fun resize(width: Int, height: Int) = post {
        surfaceWidth = width
        surfaceHeight = height
        drawFrame()
    }

    fun setVisible(value: Boolean) = post {
        visible = value
        val activePlayer = player ?: return@post
        try {
            if (value) startPlayback(activePlayer) else activePlayer.pause()
        } catch (t: IllegalStateException) {
            Log.w(TAG, "Wiedergabe konnte nicht umgeschaltet werden", t)
        }
    }

    fun setOffset(value: Float) = post {
        if (xOffset != value) {
            xOffset = value
            drawFrame()
        }
    }

    fun setSettings(value: WallpaperSettings) = post {
        val previous = settings
        settings = value
        if (previous.needsReload(value)) {
            openPlayer()
        } else {
            player?.let { activePlayer ->
                applyVolume(activePlayer)
                if (visible) applySpeed(activePlayer)
            }
            drawFrame()
        }
    }

    /** Blockiert kurz, bis der Render-Thread wirklich aufgeraeumt hat. */
    fun stop() {
        val handlerThread = thread ?: return
        handler?.post { releaseAll() }
        handlerThread.quitSafely()
        try {
            handlerThread.join(2000)
        } catch (t: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        thread = null
        handler = null
    }

    private fun post(block: () -> Unit) {
        handler?.post { block() }
    }

    // ---------------------------------------------------------------- MediaPlayer

    private fun openPlayer() {
        releasePlayer()

        val uri = settings.videoUri ?: run {
            clearToBlack()
            return
        }
        val texture = surfaceTexture ?: return

        videoInfo = VideoMeta.read(context, uri)

        val target = Surface(texture)
        playerSurface = target
        try {
            val mediaPlayer = MediaPlayer()
            mediaPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
                    .build()
            )
            mediaPlayer.setDataSource(context, uri)
            mediaPlayer.setSurface(target)
            mediaPlayer.isLooping = true
            applyVolume(mediaPlayer)
            mediaPlayer.setOnErrorListener { _, what, extra ->
                Log.w(TAG, "MediaPlayer-Fehler what=$what extra=$extra")
                true
            }
            mediaPlayer.setOnPreparedListener { prepared ->
                if (videoInfo == null) {
                    val width = prepared.videoWidth
                    val height = prepared.videoHeight
                    if (width > 0 && height > 0) {
                        videoInfo = VideoInfo(width, height, prepared.duration.toLong())
                    }
                }
                if (visible) startPlayback(prepared)
            }
            mediaPlayer.prepareAsync()
            player = mediaPlayer
        } catch (t: Throwable) {
            // Datei geloescht, Berechtigung abgelaufen oder Codec fehlt: schwarz bleiben,
            // statt den Hintergrund des Nutzers abstuerzen zu lassen.
            Log.w(TAG, "Video konnte nicht geoeffnet werden: $uri", t)
            releasePlayer()
            clearToBlack()
        }
    }

    private fun startPlayback(mediaPlayer: MediaPlayer) {
        applySpeed(mediaPlayer)
        if (!mediaPlayer.isPlaying) mediaPlayer.start()
    }

    /**
     * Achtung: setPlaybackParams startet die Wiedergabe implizit, sobald die
     * Geschwindigkeit ungleich null ist. Deshalb nur im sichtbaren Zustand aufrufen.
     */
    private fun applySpeed(mediaPlayer: MediaPlayer) {
        val speed = settings.speed.coerceIn(0.25f, 2f)
        if (speed == appliedSpeed) return
        try {
            // Bewusst frische Params: getPlaybackParams().getSpeed() wirft, solange
            // die Geschwindigkeit noch nie gesetzt wurde.
            mediaPlayer.playbackParams = PlaybackParams().setSpeed(speed).setPitch(1f)
            appliedSpeed = speed
        } catch (t: Throwable) {
            Log.w(TAG, "Geschwindigkeit $speed wird nicht unterstuetzt", t)
        }
    }

    private fun applyVolume(mediaPlayer: MediaPlayer) {
        val volume = if (settings.sound) 1f else 0f
        try {
            mediaPlayer.setVolume(volume, volume)
        } catch (t: IllegalStateException) {
            Log.w(TAG, "Lautstaerke konnte nicht gesetzt werden", t)
        }
    }

    private fun releasePlayer() {
        player?.let { activePlayer ->
            try {
                activePlayer.setOnPreparedListener(null)
                activePlayer.setOnErrorListener(null)
                activePlayer.reset()
                activePlayer.release()
            } catch (t: Throwable) {
                Log.w(TAG, "MediaPlayer konnte nicht sauber freigegeben werden", t)
            }
        }
        player = null
        appliedSpeed = 0f
        playerSurface?.release()
        playerSurface = null
        videoInfo = null
    }

    // ---------------------------------------------------------------- Zeichnen

    override fun onFrameAvailable(texture: SurfaceTexture) {
        // Zusammenfassen: haengt schon ein Zeichnen in der Queue, reicht dieses eine.
        val target = handler ?: return
        target.removeCallbacks(drawRunnable)
        target.post(drawRunnable)
    }

    private fun drawFrame() {
        val texture = surfaceTexture ?: return
        if (eglSurface == EGL14.EGL_NO_SURFACE || program == 0) return
        if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) return
        if (surfaceWidth <= 0 || surfaceHeight <= 0) return

        try {
            texture.updateTexImage()
            texture.getTransformMatrix(texMatrix)
        } catch (t: Throwable) {
            Log.w(TAG, "Frame konnte nicht uebernommen werden", t)
            return
        }

        val (scaleX, scaleY) = computeScale()
        val translateX = computeParallax(scaleX)

        GLES20.glViewport(0, 0, surfaceWidth, surfaceHeight)
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

        GLES20.glUseProgram(program)
        GLES20.glUniformMatrix4fv(uTexMatrix, 1, false, texMatrix, 0)
        GLES20.glUniform2f(uScale, scaleX, scaleY)
        GLES20.glUniform2f(uTranslate, translateX, 0f)
        GLES20.glUniform1f(uBrightness, settings.brightness.coerceIn(0f, 1f))

        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)

        positionBuffer.position(0)
        GLES20.glEnableVertexAttribArray(aPosition)
        GLES20.glVertexAttribPointer(aPosition, 2, GLES20.GL_FLOAT, false, 0, positionBuffer)

        texCoordBuffer.position(0)
        GLES20.glEnableVertexAttribArray(aTexCoord)
        GLES20.glVertexAttribPointer(aTexCoord, 2, GLES20.GL_FLOAT, false, 0, texCoordBuffer)

        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

        GLES20.glDisableVertexAttribArray(aPosition)
        GLES20.glDisableVertexAttribArray(aTexCoord)

        EGL14.eglSwapBuffers(eglDisplay, eglSurface)
    }

    /**
     * Faktor, mit dem der sichtbare Ausschnitt der Textur um ihre Mitte skaliert wird.
     * Werte unter 1 schneiden zu (Bildschirm fuellen), Werte ueber 1 lassen Platz frei
     * (einpassen) - was der Fragment-Shader dann schwarz faerbt.
     */
    private fun computeScale(): Pair<Float, Float> {
        val info = videoInfo ?: return 1f to 1f
        if (surfaceWidth <= 0 || surfaceHeight <= 0) return 1f to 1f

        val videoAspect = info.aspect
        val screenAspect = surfaceWidth.toFloat() / surfaceHeight
        if (videoAspect <= 0f || screenAspect <= 0f) return 1f to 1f

        val videoIsWider = videoAspect > screenAspect
        return if (settings.fillScreen) {
            if (videoIsWider) (screenAspect / videoAspect) to 1f else 1f to (videoAspect / screenAspect)
        } else {
            if (videoIsWider) 1f to (videoAspect / screenAspect) else (screenAspect / videoAspect) to 1f
        }
    }

    /**
     * Beim Zuschneiden bleibt links und rechts Videomaterial uebrig. Genau dieser
     * Spielraum wird auf das Wischen zwischen den Startbildschirm-Seiten gelegt.
     */
    private fun computeParallax(scaleX: Float): Float {
        if (!settings.parallax || scaleX >= 1f) return 0f
        return (xOffset.coerceIn(0f, 1f) - 0.5f) * (1f - scaleX)
    }

    private fun clearToBlack() {
        if (eglSurface == EGL14.EGL_NO_SURFACE) return
        if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) return
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
        EGL14.eglSwapBuffers(eglDisplay, eglSurface)
    }

    // ---------------------------------------------------------------- EGL / GL

    private fun initEgl(surface: Surface): Boolean {
        eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        if (eglDisplay == EGL14.EGL_NO_DISPLAY) return fail("Kein EGL-Display")

        val version = IntArray(2)
        if (!EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) return fail("eglInitialize")

        val configAttributes = intArrayOf(
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val configCount = IntArray(1)
        if (!EGL14.eglChooseConfig(eglDisplay, configAttributes, 0, configs, 0, 1, configCount, 0) ||
            configCount[0] == 0
        ) {
            return fail("Keine passende EGL-Konfiguration")
        }
        val config = configs[0] ?: return fail("Keine passende EGL-Konfiguration")

        eglContext = EGL14.eglCreateContext(
            eglDisplay, config, EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0
        )
        if (eglContext == EGL14.EGL_NO_CONTEXT) return fail("eglCreateContext")

        eglSurface = EGL14.eglCreateWindowSurface(
            eglDisplay, config, surface, intArrayOf(EGL14.EGL_NONE), 0
        )
        if (eglSurface == EGL14.EGL_NO_SURFACE) return fail("eglCreateWindowSurface")

        if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) {
            return fail("eglMakeCurrent")
        }
        return true
    }

    private fun initGl(): Boolean {
        program = buildProgram() ?: return fail("Shader-Programm")

        aPosition = GLES20.glGetAttribLocation(program, "aPosition")
        aTexCoord = GLES20.glGetAttribLocation(program, "aTexCoord")
        uTexMatrix = GLES20.glGetUniformLocation(program, "uTexMatrix")
        uScale = GLES20.glGetUniformLocation(program, "uScale")
        uTranslate = GLES20.glGetUniformLocation(program, "uTranslate")
        uBrightness = GLES20.glGetUniformLocation(program, "uBrightness")

        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE
        )

        surfaceTexture = SurfaceTexture(textureId).apply {
            setOnFrameAvailableListener(this@VideoRenderer)
        }
        return true
    }

    private fun buildProgram(): Int? {
        val vertex = compileShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER) ?: return null
        val fragment = compileShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER) ?: run {
            GLES20.glDeleteShader(vertex)
            return null
        }
        val handle = GLES20.glCreateProgram()
        GLES20.glAttachShader(handle, vertex)
        GLES20.glAttachShader(handle, fragment)
        GLES20.glLinkProgram(handle)

        val linked = IntArray(1)
        GLES20.glGetProgramiv(handle, GLES20.GL_LINK_STATUS, linked, 0)
        // Die Shader haengen jetzt am Programm und werden nicht mehr einzeln gebraucht.
        GLES20.glDeleteShader(vertex)
        GLES20.glDeleteShader(fragment)
        if (linked[0] == 0) {
            Log.e(TAG, "Programm-Link fehlgeschlagen: ${GLES20.glGetProgramInfoLog(handle)}")
            GLES20.glDeleteProgram(handle)
            return null
        }
        return handle
    }

    private fun compileShader(type: Int, source: String): Int? {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, source.trimIndent())
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] == 0) {
            Log.e(TAG, "Shader-Fehler: ${GLES20.glGetShaderInfoLog(shader)}")
            GLES20.glDeleteShader(shader)
            return null
        }
        return shader
    }

    private fun fail(reason: String): Boolean {
        Log.e(TAG, "GL-Initialisierung fehlgeschlagen: $reason (0x${Integer.toHexString(EGL14.eglGetError())})")
        return false
    }

    private fun releaseAll() {
        releasePlayer()
        surfaceTexture?.let {
            it.setOnFrameAvailableListener(null)
            it.release()
        }
        surfaceTexture = null

        if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
            if (program != 0) {
                GLES20.glDeleteProgram(program)
                program = 0
            }
            if (textureId != 0) {
                GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
                textureId = 0
            }
            EGL14.eglMakeCurrent(
                eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT
            )
            if (eglSurface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(eglDisplay, eglSurface)
            if (eglContext != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(eglDisplay, eglContext)
            EGL14.eglTerminate(eglDisplay)
        }
        eglSurface = EGL14.EGL_NO_SURFACE
        eglContext = EGL14.EGL_NO_CONTEXT
        eglDisplay = EGL14.EGL_NO_DISPLAY
    }
}

private fun FloatArray.toFloatBuffer(): FloatBuffer =
    ByteBuffer.allocateDirect(size * Float.SIZE_BYTES)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer()
        .also {
            it.put(this)
            it.position(0)
        }
