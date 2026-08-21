package io.github.spacecrafter29.videowallpaper

import android.content.SharedPreferences
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder

/**
 * Meldet den Video-Hintergrund beim System an. Android erzeugt pro Anzeigeort
 * (Vorschau, Startbildschirm, Sperrbildschirm) eine eigene Engine - jede bekommt
 * darum ihren eigenen Renderer.
 */
class VideoWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = VideoEngine()

    private inner class VideoEngine :
        Engine(),
        SharedPreferences.OnSharedPreferenceChangeListener {

        private val prefs = Prefs.open(this@VideoWallpaperService)
        private var renderer: VideoRenderer? = null

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            setTouchEventsEnabled(false)
            setOffsetNotificationsEnabled(true)
            prefs.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            val frame = holder.surfaceFrame
            renderer = VideoRenderer(applicationContext).apply {
                start(holder.surface, frame.width(), frame.height(), Prefs.read(prefs))
                setVisible(this@VideoEngine.isVisible)
            }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            renderer?.resize(width, height)
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            renderer?.stop()
            renderer = null
            super.onSurfaceDestroyed(holder)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            super.onVisibilityChanged(visible)
            // Der Akku-Sparmechanismus: ist der Bildschirm aus oder eine App im
            // Vordergrund, meldet Android die Engine als unsichtbar und die
            // Dekodierung wird angehalten.
            renderer?.setVisible(visible)
        }

        override fun onOffsetsChanged(
            xOffset: Float,
            yOffset: Float,
            xOffsetStep: Float,
            yOffsetStep: Float,
            xPixelOffset: Int,
            yPixelOffset: Int
        ) {
            super.onOffsetsChanged(
                xOffset, yOffset, xOffsetStep, yOffsetStep, xPixelOffset, yPixelOffset
            )
            renderer?.setOffset(xOffset)
        }

        override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences, key: String?) {
            renderer?.setSettings(Prefs.read(sharedPreferences))
        }

        override fun onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            renderer?.stop()
            renderer = null
            super.onDestroy()
        }
    }
}
