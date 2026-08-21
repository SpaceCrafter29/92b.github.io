package io.github.spacecrafter29.videowallpaper

import android.app.Activity
import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.edit
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import io.github.spacecrafter29.videowallpaper.databinding.ActivityMainBinding
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Einstellungen des Video-Hintergrunds. Gespeichert wird direkt in die
 * SharedPreferences - der laufende WallpaperService hoert darauf und uebernimmt
 * Aenderungen sofort.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences

    private val metaExecutor = Executors.newSingleThreadExecutor()

    /** Verhindert, dass das Zurueckschreiben der UI wieder Speichervorgaenge ausloest. */
    private var restoring = false

    private val pickVideo = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uri = result.data?.data
        if (result.resultCode == Activity.RESULT_OK && uri != null) {
            onVideoPicked(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyWindowInsets()

        prefs = Prefs.open(this)
        wireUi()
        restoreState()
    }

    override fun onDestroy() {
        metaExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun applyWindowInsets() {
        val content = binding.content
        val basePaddingTop = content.paddingTop
        val basePaddingBottom = content.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updatePadding(
                top = basePaddingTop + bars.top,
                bottom = basePaddingBottom + bars.bottom
            )
            insets
        }
    }

    private fun wireUi() {
        binding.pickButton.setOnClickListener { launchPicker() }
        binding.applyButton.setOnClickListener { applyWallpaper() }

        binding.fillSwitch.setOnCheckedChangeListener { _, checked ->
            store { putBoolean(Prefs.KEY_FILL_SCREEN, checked) }
        }
        binding.parallaxSwitch.setOnCheckedChangeListener { _, checked ->
            store { putBoolean(Prefs.KEY_PARALLAX, checked) }
        }
        binding.soundSwitch.setOnCheckedChangeListener { _, checked ->
            store { putBoolean(Prefs.KEY_SOUND, checked) }
        }

        binding.brightnessSlider.addOnChangeListener { _, value, fromUser ->
            updateSliderLabels()
            if (fromUser) store { putInt(Prefs.KEY_BRIGHTNESS, value.toInt()) }
        }
        binding.speedSlider.addOnChangeListener { _, value, fromUser ->
            updateSliderLabels()
            if (fromUser) store { putInt(Prefs.KEY_SPEED, value.toInt()) }
        }
    }

    private fun store(action: SharedPreferences.Editor.() -> Unit) {
        if (restoring) return
        prefs.edit(action = action)
    }

    private fun restoreState() {
        val settings = Prefs.read(prefs)
        restoring = true
        binding.fillSwitch.isChecked = settings.fillScreen
        binding.parallaxSwitch.isChecked = settings.parallax
        binding.soundSwitch.isChecked = settings.sound
        binding.brightnessSlider.value = snap(settings.brightnessPercent, from = 20, to = 100)
        binding.speedSlider.value = snap(settings.speedPercent, from = 25, to = 200)
        restoring = false

        updateSliderLabels()
        showVideo(settings.videoUri)
    }

    /**
     * Der Slider besteht auf Werten, die exakt auf seinem Raster liegen, sonst wirft er.
     * Ein aus den Preferences gelesener Wert wird darum aufs Raster gezogen.
     */
    private fun snap(value: Int, from: Int, to: Int, step: Int = 5): Float {
        val clamped = value.coerceIn(from, to)
        val steps = Math.round((clamped - from) / step.toFloat())
        return (from + steps * step).coerceIn(from, to).toFloat()
    }

    private fun updateSliderLabels() {
        val brightness = binding.brightnessSlider.value.toInt()
        binding.brightnessLabel.text = getString(R.string.brightness_value, brightness)

        val speed = binding.speedSlider.value / 100f
        val formatted = String.format(Locale.getDefault(), "%.2f", speed).trimEnd('0').trimEnd('.', ',')
        binding.speedLabel.text = getString(R.string.speed_value, formatted)
    }

    private fun launchPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "video/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        try {
            pickVideo.launch(intent)
        } catch (t: ActivityNotFoundException) {
            toast(R.string.toast_no_picker)
        }
    }

    private fun onVideoPicked(uri: Uri) {
        // Ohne dauerhafte Berechtigung waere das Video nach einem Neustart nicht mehr
        // lesbar. Manche Anbieter (z.B. Cloud-Inhalte) erlauben das aber nicht.
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (t: SecurityException) {
            toast(R.string.toast_permission_temporary)
        }
        prefs.edit { putString(Prefs.KEY_VIDEO_URI, uri.toString()) }
        showVideo(uri)
    }

    private fun showVideo(uri: Uri?) {
        if (uri == null) {
            binding.videoTitle.setText(R.string.no_video_selected)
            binding.videoMeta.setText(R.string.no_video_hint)
            binding.pickButton.setText(R.string.pick_video)
            return
        }

        binding.videoTitle.text = uri.lastPathSegment ?: uri.toString()
        binding.videoMeta.setText(R.string.loading)
        binding.pickButton.setText(R.string.change_video)

        // Metadaten lesen heisst Datei-IO - das gehoert nicht auf den Main-Thread.
        metaExecutor.execute {
            val name = VideoMeta.displayName(this, uri)
            val info = VideoMeta.read(this, uri)
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (Prefs.read(prefs).videoUri != uri) return@runOnUiThread
                binding.videoTitle.text = name ?: uri.lastPathSegment ?: uri.toString()
                binding.videoMeta.text = if (info != null) {
                    getString(R.string.video_meta, info.width, info.height, info.formatDuration())
                } else {
                    getString(R.string.toast_unreadable)
                }
            }
        }
    }

    private fun applyWallpaper() {
        if (Prefs.read(prefs).videoUri == null) {
            toast(R.string.toast_no_video)
            return
        }

        val component = ComponentName(this, VideoWallpaperService::class.java)
        val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
            .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        try {
            startActivity(direct)
            return
        } catch (t: ActivityNotFoundException) {
            // Faellt unten auf die allgemeine Auswahl zurueck.
        }

        try {
            startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
        } catch (t: ActivityNotFoundException) {
            toast(R.string.toast_no_chooser)
        }
    }

    private fun toast(resId: Int) {
        Toast.makeText(this, resId, Toast.LENGTH_LONG).show()
    }
}
