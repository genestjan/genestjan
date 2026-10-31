package com.genestjanramirez.gendrive.service

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.genestjanramirez.gendrive.system.Permissions
import com.genestjanramirez.gendrive.ui.MainActivity

/**
 * Covers a video app's picture while the car can move. The video app keeps
 * playing underneath, so the sound continues: YouTube becomes a podcast.
 * The picture comes back the moment the car is in Park.
 *
 * Needs "Draw over other apps" and "Usage access". Without them it does nothing.
 */
class VideoGuard(private val context: Context) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val usage = context.getSystemService(UsageStatsManager::class.java)
    private var overlay: View? = null
    private var lastForeground: String? = null
    private var lastQueryMs = 0L

    val isShowing: Boolean get() = overlay != null

    fun canRun(): Boolean = Settings.canDrawOverlays(context) && Permissions.hasUsageAccess(context)

    /** The package most recently brought to the front, from usage events. */
    fun foregroundPackage(): String? {
        val now = System.currentTimeMillis()
        // First look back far enough to catch a video app opened long before the service started.
        val from = if (lastQueryMs == 0L) now - 6 * 3_600_000L else lastQueryMs - 1_000
        lastQueryMs = now
        try {
            val events = usage?.queryEvents(from, now) ?: return lastForeground
            val e = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(e)
                @Suppress("DEPRECATION")
                if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) lastForeground = e.packageName
            }
        } catch (t: Throwable) {
            // Usage access was revoked; keep the last answer.
        }
        return lastForeground
    }

    fun show() {
        if (overlay != null || !Settings.canDrawOverlays(context)) return
        val dp = { v: Float -> TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, context.resources.displayMetrics).toInt() }
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#F2070B14"))
            setPadding(dp(48f), dp(48f), dp(48f), dp(48f))
        }
        fun text(value: String, sizeSp: Float, color: String, bold: Boolean = false) = TextView(context).apply {
            text = value
            setTextColor(Color.parseColor(color))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
            gravity = Gravity.CENTER
            if (bold) setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(8f), 0, dp(8f))
        }
        root.addView(text("♪", 64f, "#2EE6A6", bold = true))
        root.addView(text("Audio only while moving", 34f, "#F2F6FC", bold = true))
        root.addView(text("Sound keeps playing. The picture comes back when you shift to P.", 22f, "#93A4BD"))
        root.addView(
            Button(context).apply {
                text = "Back to GenDrive"
                setTextColor(Color.parseColor("#04140E"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                isAllCaps = false
                background = GradientDrawable().apply {
                    cornerRadius = dp(40f).toFloat()
                    setColor(Color.parseColor("#2EE6A6"))
                }
                setPadding(dp(40f), dp(18f), dp(40f), dp(18f))
                setOnClickListener {
                    context.startActivity(
                        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
                    )
                }
            },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(32f)
            },
        )
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // Not focusable: the video app keeps focus, so it keeps playing.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        )
        try {
            windowManager?.addView(root, params)
            overlay = root
        } catch (t: Throwable) {
            overlay = null
        }
    }

    fun hide() {
        val v = overlay ?: return
        overlay = null
        try {
            windowManager?.removeView(v)
        } catch (t: Throwable) {
            // Already gone.
        }
    }
}
