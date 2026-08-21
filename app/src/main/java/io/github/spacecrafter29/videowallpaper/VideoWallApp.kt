package io.github.spacecrafter29.videowallpaper

import android.app.Application
import com.google.android.material.color.DynamicColors

class VideoWallApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Auf Pixel-Geraeten uebernimmt die App damit die Farben des System-Themes.
        DynamicColors.applyToActivitiesIfAvailable(this)
    }
}
