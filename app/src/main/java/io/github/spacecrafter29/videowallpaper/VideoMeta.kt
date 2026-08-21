package io.github.spacecrafter29.videowallpaper

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import java.util.Locale

data class VideoInfo(
    /** Breite so, wie das Video tatsaechlich angezeigt wird (Rotation bereits eingerechnet). */
    val width: Int,
    val height: Int,
    val durationMs: Long
) {
    val aspect: Float get() = if (height > 0) width.toFloat() / height else 1f

    fun formatDuration(): String {
        val totalSeconds = durationMs / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds)
    }
}

object VideoMeta {

    /**
     * Liest Abmessungen und Laenge. Ein hochkant gedrehtes Video meldet in den Metadaten
     * die unrotierten Abmessungen plus einen Rotationswinkel - fuer die Seitenverhaeltnis-
     * Rechnung muessen Breite und Hoehe bei 90/270 Grad getauscht werden.
     */
    fun read(context: Context, uri: Uri): VideoInfo? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            val width = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: return null
            val height = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: return null
            if (width <= 0 || height <= 0) return null

            val duration = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
            val rotation = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
                ?.toIntOrNull() ?: 0

            if (rotation == 90 || rotation == 270) {
                VideoInfo(height, width, duration)
            } else {
                VideoInfo(width, height, duration)
            }
        } catch (t: Throwable) {
            null
        } finally {
            try {
                retriever.release()
            } catch (t: Throwable) {
                // Beim Aufraeumen ist ein Fehler nicht mehr interessant.
            }
        }
    }

    fun displayName(context: Context, uri: Uri): String? = try {
        context.contentResolver
            .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
            }
    } catch (t: Throwable) {
        null
    }
}
