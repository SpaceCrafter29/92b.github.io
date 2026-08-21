package io.github.spacecrafter29.videowallpaper

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri

/**
 * Einstellungen der App. Activity und WallpaperService laufen im selben Prozess,
 * daher reicht eine gemeinsame SharedPreferences-Datei samt Change-Listener aus,
 * damit Aenderungen sofort im laufenden Hintergrund sichtbar werden.
 */
object Prefs {

    private const val NAME = "videowall"

    const val KEY_VIDEO_URI = "video_uri"
    const val KEY_FILL_SCREEN = "fill_screen"
    const val KEY_BRIGHTNESS = "brightness_percent"
    const val KEY_PARALLAX = "parallax"
    const val KEY_SPEED = "speed_percent"
    const val KEY_SOUND = "sound"

    const val DEFAULT_BRIGHTNESS = 100
    const val DEFAULT_SPEED = 100

    fun open(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun read(prefs: SharedPreferences): WallpaperSettings = WallpaperSettings(
        videoUri = prefs.getString(KEY_VIDEO_URI, null)?.let(Uri::parse),
        fillScreen = prefs.getBoolean(KEY_FILL_SCREEN, true),
        brightnessPercent = prefs.getInt(KEY_BRIGHTNESS, DEFAULT_BRIGHTNESS),
        parallax = prefs.getBoolean(KEY_PARALLAX, true),
        speedPercent = prefs.getInt(KEY_SPEED, DEFAULT_SPEED),
        sound = prefs.getBoolean(KEY_SOUND, false)
    )
}

data class WallpaperSettings(
    val videoUri: Uri?,
    val fillScreen: Boolean,
    val brightnessPercent: Int,
    val parallax: Boolean,
    val speedPercent: Int,
    val sound: Boolean
) {
    val brightness: Float get() = brightnessPercent / 100f
    val speed: Float get() = speedPercent / 100f

    /** Nur diese Werte erzwingen ein Neu-Oeffnen des Players. */
    fun needsReload(other: WallpaperSettings): Boolean =
        videoUri != other.videoUri
}
